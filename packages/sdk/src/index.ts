import type {
  PayeezConfig,
  PayeezError,
  Payment,
  SessionConfig,
} from '@payeez/shared';

// ============================================
// Payeez SDK
// Processor-agnostic payment capture with Basis Theory
// ============================================

const API_BASE = 'https://api.payeez.co'; // TODO: make configurable

interface PayeezState {
  config: PayeezConfig | null;
  sessionConfig: SessionConfig | null;
  basisTheory: any | null;
  cardElement: any | null;
  mounted: boolean;
}

const state: PayeezState = {
  config: null,
  sessionConfig: null,
  basisTheory: null,
  cardElement: null,
  mounted: false,
};

/**
 * Mount the Payeez payment form
 * Loads Basis Theory Elements and renders card input
 */
export async function mount(config: PayeezConfig): Promise<void> {
  if (state.mounted) {
    console.warn('[Payeez] Already mounted. Call unmount() first.');
    return;
  }

  state.config = config;

  const container = document.getElementById(config.elementId);
  if (!container) {
    throw createError('ELEMENT_NOT_FOUND', `Element #${config.elementId} not found`);
  }

  try {
    // 1. Fetch session config from Payeez API
    state.sessionConfig = await fetchSessionConfig(config.sessionId, config.clientSecret);

    // 2. Initialize Basis Theory
    await initBasisTheory(state.sessionConfig.basis_theory_key!);

    // 3. Create and mount card element
    await mountCardElement(container, config.appearance);

    // 4. Set up form submission handler
    setupFormHandler(container);

    state.mounted = true;
    config.onReady?.();
  } catch (err) {
    const error = normalizeError(err);
    config.onError?.(error);

    // Fallback: redirect to hosted checkout if available
    if (state.sessionConfig?.fallback_url) {
      console.warn('[Payeez] Falling back to hosted checkout');
      window.location.href = state.sessionConfig.fallback_url;
    }

    throw error;
  }
}

/**
 * Unmount the payment form and clean up
 */
export function unmount(): void {
  if (state.cardElement) {
    state.cardElement.unmount();
    state.cardElement = null;
  }
  state.config = null;
  state.sessionConfig = null;
  state.basisTheory = null;
  state.mounted = false;
}

/**
 * Manually confirm the payment (if not auto-confirmed on submit)
 */
export async function confirm(): Promise<Payment> {
  if (!state.sessionConfig || !state.cardElement) {
    throw createError('NOT_MOUNTED', 'Payment form not mounted');
  }

  return await tokenizeAndConfirm();
}

// ============================================
// Internal Functions
// ============================================

async function fetchSessionConfig(
  sessionId: string,
  clientSecret: string
): Promise<SessionConfig> {
  const res = await fetch(`${API_BASE}/v1/sessions/${sessionId}/config`, {
    headers: {
      Authorization: `Bearer ${clientSecret}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw createError(
      'SESSION_FETCH_FAILED',
      error.message || 'Failed to fetch session config'
    );
  }

  return res.json();
}

async function initBasisTheory(publicKey: string): Promise<void> {
  // Dynamically import Basis Theory to keep bundle small if not used
  const { BasisTheory } = await import('@basis-theory/basis-theory-js');

  state.basisTheory = await new BasisTheory().init(publicKey, {
    elements: true,
  });
}

async function mountCardElement(
  container: HTMLElement,
  appearance?: PayeezConfig['appearance']
): Promise<void> {
  // Create a wrapper for the card element
  const wrapper = document.createElement('div');
  wrapper.id = 'payeez-card-element';
  wrapper.style.cssText = `
    padding: 12px;
    border: 1px solid #e0e0e0;
    border-radius: ${appearance?.variables?.borderRadius || '8px'};
    background: ${appearance?.variables?.colorBackground || '#ffffff'};
    font-family: ${appearance?.variables?.fontFamily || 'system-ui, sans-serif'};
  `;
  container.appendChild(wrapper);

  // Create Basis Theory card element
  state.cardElement = state.basisTheory.createElement('card', {
    style: {
      base: {
        color: appearance?.variables?.colorText || '#1a1a1a',
        fontSize: '16px',
        fontFamily: appearance?.variables?.fontFamily || 'system-ui, sans-serif',
        '::placeholder': {
          color: '#a0a0a0',
        },
      },
      invalid: {
        color: '#dc2626',
      },
    },
  });

  await state.cardElement.mount('#payeez-card-element');
}

function setupFormHandler(container: HTMLElement): void {
  const form = container.closest('form');
  if (!form) {
    console.warn('[Payeez] No parent form found. Call confirm() manually.');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
      const payment = await tokenizeAndConfirm();
      state.config?.onSuccess?.(payment);
    } catch (err) {
      state.config?.onError?.(normalizeError(err));
    }
  });
}

async function tokenizeAndConfirm(): Promise<Payment> {
  if (!state.basisTheory || !state.cardElement || !state.sessionConfig) {
    throw createError('NOT_READY', 'SDK not properly initialized');
  }

  // 1. Tokenize card data with Basis Theory
  const token = await state.basisTheory.tokens.create({
    type: 'card',
    data: state.cardElement,
  });

  // 2. Send token to Payeez API to confirm payment
  const res = await fetch(
    `${API_BASE}/v1/sessions/${state.sessionConfig.session_id}/confirm`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.sessionConfig.client_secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token_id: token.id,
        token_provider: 'basis_theory',
      }),
    }
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw createError(
      error.code || 'PAYMENT_FAILED',
      error.message || 'Payment confirmation failed'
    );
  }

  return res.json();
}

function createError(code: string, message: string): PayeezError {
  return { code, message };
}

function normalizeError(err: unknown): PayeezError {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    return err as PayeezError;
  }

  if (err instanceof Error) {
    return { code: 'UNKNOWN_ERROR', message: err.message };
  }

  return { code: 'UNKNOWN_ERROR', message: 'An unknown error occurred' };
}

// ============================================
// Default Export
// ============================================

export const Payeez = {
  mount,
  unmount,
  confirm,
};

export default Payeez;
