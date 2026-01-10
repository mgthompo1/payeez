/**
 * Atlas Vault - Provider Abstraction Layer
 *
 * This module provides a unified interface for card tokenization and
 * PSP forwarding, regardless of the underlying provider.
 *
 * Provider selection is controlled at the PLATFORM level (admin config),
 * not exposed to tenants. This allows Atlas to:
 *
 * Phase 1: Use Basis Theory (stay out of PCI scope)
 * Phase 2: Optionally switch to VGS
 * Phase 3: Migrate to Atlas-owned CDE infrastructure
 *
 * The switch is a config change, not a code change.
 *
 * @example
 * ```typescript
 * import { getVault, getProxy } from '@/lib/vault';
 *
 * // Get token metadata
 * const vault = getVault();
 * const token = await vault.getToken('tok_xxx');
 *
 * // Forward request to PSP
 * const proxy = getProxy();
 * const result = await proxy.forward({
 *   destination: 'https://api.stripe.com/v1/charges',
 *   method: 'POST',
 *   headers: { 'Authorization': 'Bearer sk_xxx' },
 *   body: stripePayload,
 *   tokenId: 'tok_xxx',
 * });
 * ```
 */

import type { VaultProvider, ProxyProvider, PublicConfig } from './types';
import { createBasisTheoryVault, createBasisTheoryProxy } from './providers/basis-theory';
// import { createVGSVault, createVGSProxy } from './providers/vgs';  // Future
import { createAtlasCDEVault, createAtlasCDEProxy } from './providers/atlas-cde';

// =============================================================================
// Provider Configuration
// =============================================================================

export type VaultProviderType = 'basis_theory' | 'vgs' | 'atlas';

/**
 * Get the configured vault provider type
 * This is an ADMIN/PLATFORM setting, not tenant-configurable
 */
function getProviderType(): VaultProviderType {
  const provider = process.env.VAULT_PROVIDER || Deno?.env?.get?.('VAULT_PROVIDER') || 'basis_theory';

  if (!['basis_theory', 'vgs', 'atlas'].includes(provider)) {
    console.warn(`[Vault] Unknown provider "${provider}", falling back to basis_theory`);
    return 'basis_theory';
  }

  return provider as VaultProviderType;
}

// =============================================================================
// Singleton Instances
// =============================================================================

let vaultInstance: VaultProvider | null = null;
let proxyInstance: ProxyProvider | null = null;

/**
 * Get the vault provider instance
 * Singleton - created once per process
 */
export function getVault(): VaultProvider {
  if (!vaultInstance) {
    const provider = getProviderType();

    switch (provider) {
      case 'basis_theory':
        vaultInstance = createBasisTheoryVault();
        break;
      case 'vgs':
        // vaultInstance = createVGSVault();
        throw new Error('VGS provider not yet implemented');
      case 'atlas':
        vaultInstance = createAtlasCDEVault();
        break;
    }

    console.log(`[Vault] Initialized ${provider} vault provider`);
  }

  return vaultInstance!;
}

/**
 * Get the proxy provider instance
 * Singleton - created once per process
 */
export function getProxy(): ProxyProvider {
  if (!proxyInstance) {
    const provider = getProviderType();

    switch (provider) {
      case 'basis_theory':
        proxyInstance = createBasisTheoryProxy();
        break;
      case 'vgs':
        // proxyInstance = createVGSProxy();
        throw new Error('VGS provider not yet implemented');
      case 'atlas':
        proxyInstance = createAtlasCDEProxy();
        break;
    }

    console.log(`[Vault] Initialized ${provider} proxy provider`);
  }

  return proxyInstance!;
}

/**
 * Get public config for frontend Elements
 * This is safe to expose to tenants
 */
export function getPublicConfig(): PublicConfig {
  return getVault().getPublicConfig();
}

/**
 * Get current provider type
 * Useful for conditional logic
 */
export function getCurrentProvider(): VaultProviderType {
  return getProviderType();
}

// =============================================================================
// Re-exports
// =============================================================================

export type {
  VaultProvider,
  ProxyProvider,
  PublicConfig,
  TokenMetadata,
  CardData,
  CardBrand,
  CardField,
  ProxyRequest,
  ProxyResponse,
  CreateTokenOptions,
} from './types';

export { tokenPlaceholder, btPlaceholder, vgsPlaceholder } from './types';
