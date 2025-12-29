/**
 * Windcave WooCommerce Blocks Payment Method
 *
 * React component for WooCommerce Blocks checkout.
 */

const { registerPaymentMethod } = window.wc.wcBlocksRegistry;
const { decodeEntities } = window.wp.htmlEntities;
const { getSetting } = window.wc.wcSettings;
const { createElement, useEffect, useState, useCallback, useRef } = window.wp.element;

// Get settings from PHP
const settings = getSetting('windcave_data', {});
const label = decodeEntities(settings.title) || 'Credit/Debit Card';

/**
 * Content component - renders the payment form
 */
const WindcaveContent = (props) => {
    const { eventRegistration, emitResponse, billing } = props;
    const { onPaymentSetup } = eventRegistration;

    const [sessionData, setSessionData] = useState(null);
    const [controller, setController] = useState(null);
    const [error, setError] = useState(null);
    const [isReady, setIsReady] = useState(false);
    const [selectedToken, setSelectedToken] = useState(null);

    // Ref to store promise resolver for drop-in payment completion
    const pendingPaymentRef = useRef(null);

    // Create session
    const createSession = useCallback(async () => {
        try {
            const response = await fetch(windcaveBlocksData.ajaxUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    action: 'windcave_create_session',
                    nonce: windcaveBlocksData.nonce,
                    amount: billing.cartTotal.value / 100, // Convert from cents
                    currency: billing.currency.code,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setSessionData(data.data);
                return data.data;
            } else {
                throw new Error(data.data.message || settings.i18n.sessionError);
            }
        } catch (err) {
            setError(err.message);
            return null;
        }
    }, [billing.cartTotal.value, billing.currency.code]);

    // Initialize Drop-in
    const initDropIn = useCallback((session) => {
        if (!window.WindcavePayments || !window.WindcavePayments.DropIn) {
            console.error('Windcave Drop-in library not loaded');
            return;
        }

        const options = {
            container: 'windcave-blocks-dropin-container',
            links: session.links,
            env: windcaveBlocksData.environment,
            totalValue: (billing.cartTotal.value / 100).toString(),
            onSuccess: (status) => {
                console.log('Windcave Drop-in onSuccess:', status);
                const statusLower = (status || '').toLowerCase();

                // 3DSecure means the iframe is still processing - just return
                if (statusLower === '3dsecure') {
                    console.log('Windcave Drop-in: 3DSecure in progress, waiting...');
                    return;
                }

                // Only proceed on "done"
                if (statusLower === 'done') {
                    console.log('Windcave Drop-in: Payment complete');
                    // Close the drop-in
                    if (window.windcaveDropIn) {
                        window.windcaveDropIn.close();
                        window.windcaveDropIn = null;
                    }
                    setIsReady(true);
                    // Resolve any pending payment promise
                    if (pendingPaymentRef.current) {
                        console.log('Windcave Drop-in: Resolving pending payment promise');
                        if (pendingPaymentRef.current.timeout) {
                            clearTimeout(pendingPaymentRef.current.timeout);
                        }
                        pendingPaymentRef.current.resolve({
                            type: emitResponse.responseTypes.SUCCESS,
                            meta: {
                                paymentMethodData: {
                                    windcave_session_id: session.sessionId,
                                    windcave_payment_complete: 'true',
                                },
                            },
                        });
                        pendingPaymentRef.current = null;
                    }
                }
            },
            onError: (stage, err) => {
                console.error('Windcave Drop-in error:', stage, err);
                // Close the drop-in on error
                if (window.windcaveDropIn) {
                    window.windcaveDropIn.close();
                    window.windcaveDropIn = null;
                }
                setError(settings.i18n.paymentError);
                // Reject any pending payment promise
                if (pendingPaymentRef.current) {
                    console.log('Windcave Drop-in: Rejecting pending payment promise due to error');
                    if (pendingPaymentRef.current.timeout) {
                        clearTimeout(pendingPaymentRef.current.timeout);
                    }
                    pendingPaymentRef.current.resolve({
                        type: emitResponse.responseTypes.ERROR,
                        message: settings.i18n.paymentError,
                    });
                    pendingPaymentRef.current = null;
                }
            },
            card: {
                supportedCards: settings.supportedCards,
                hideCardholderName: false,
                enableCardValidation: true,
                enableCardFormatting: true,
            },
            security: {
                enableAutoComplete: true,
                enableSecureForm: true,
                enableFormValidation: true,
            },
        };

        // Add mobile payment options
        if (settings.enableApplePay || settings.enableGooglePay) {
            options.mobilePayments = {
                merchantName: settings.storeName,
                countryCode: settings.country,
                currencyCode: settings.currency,
                supportedNetworks: settings.supportedCards,
                isTest: settings.isTestMode,
            };

            if (settings.enableApplePay && settings.applePayMerchantId) {
                options.mobilePayments.applePay = {
                    merchantId: settings.applePayMerchantId,
                };
            }

            if (settings.enableGooglePay && settings.googlePayMerchantId) {
                options.mobilePayments.googlePay = {
                    merchantId: settings.googlePayMerchantId,
                };
            }
        }

        // Store the drop-in instance globally so we can close it later
        window.windcaveDropIn = window.WindcavePayments.DropIn.create(options);
        setController(window.windcaveDropIn);
        console.log('Windcave Drop-in initialized in Blocks');
    }, [billing.cartTotal.value, emitResponse.responseTypes]);

    // Initialize Hosted Fields
    const initHostedFields = useCallback((session) => {
        if (!window.WindcavePayments || !window.WindcavePayments.HostedFields) {
            console.error('Windcave Hosted Fields library not loaded');
            return;
        }

        const options = {
            sessionId: session.sessionId,
            env: windcaveBlocksData.environment,
            fields: {
                CardNumber: {
                    container: 'windcave-blocks-card-number',
                    placeholder: '1234 5678 9012 3456',
                    supportedCards: settings.supportedCards,
                    cardSchemaImagePlacement: 'right',
                    tabOrder: 1,
                    length: {
                        jumpToNextField: true,
                    },
                },
                ExpirationDate: {
                    container: 'windcave-blocks-expiry',
                    placeholder: 'MM/YY',
                    tabOrder: 2,
                    length: {
                        jumpToNextField: true,
                    },
                },
                CVV: {
                    container: 'windcave-blocks-cvv',
                    placeholder: '123',
                    tabOrder: 3,
                    length: {
                        jumpToNextField: true,
                    },
                },
                CardholderName: {
                    container: 'windcave-blocks-cardholder',
                    placeholder: settings.i18n.cardholderLabel,
                    tabOrder: 4,
                },
            },
            styles: {
                input: {
                    'font-size': '16px',
                    'font-family': 'inherit',
                    color: '#333',
                    padding: '10px',
                },
                'input-valid': {
                    color: '#333',
                },
                'input-invalid': {
                    color: '#dc3545',
                },
            },
            threeDsIFrame: {
                overlayBgColor: 'rgba(0, 0, 0, 0.5)',
                dimensions: {
                    width: '500px',
                    height: '600px',
                },
            },
        };

        // Controller is returned directly from create(), not passed to callback
        const ctrl = window.WindcavePayments.HostedFields.create(
            options,
            30,
            () => {
                console.log('Windcave Hosted Fields initialized and ready in Blocks');
            },
            (err) => {
                console.error('Windcave Hosted Fields creation error:', err);
                setError(settings.i18n.sessionError);
            }
        );

        // Store controller
        setController(ctrl);
        console.log('Windcave Hosted Fields controller stored:', ctrl);
    }, []);

    // Initialize on mount
    useEffect(() => {
        if (!selectedToken) {
            createSession().then((session) => {
                if (session) {
                    if (settings.integrationMode === 'dropin') {
                        // Small delay to ensure container is rendered
                        setTimeout(() => initDropIn(session), 100);
                    } else {
                        setTimeout(() => initHostedFields(session), 100);
                    }
                }
            });
        }
    }, [selectedToken, createSession, initDropIn, initHostedFields]);

    // Handle payment setup
    useEffect(() => {
        const unsubscribe = onPaymentSetup(() => {
            // Using saved token
            if (selectedToken) {
                return {
                    type: emitResponse.responseTypes.SUCCESS,
                    meta: {
                        paymentMethodData: {
                            'wc-windcave-payment-token': selectedToken,
                        },
                    },
                };
            }

            // Check if session is ready
            if (!sessionData) {
                return {
                    type: emitResponse.responseTypes.ERROR,
                    message: settings.i18n.sessionError,
                };
            }

            // For Drop-in, trigger submission by clicking the hidden drop-in button
            if (settings.integrationMode === 'dropin') {
                console.log('Windcave Blocks: Drop-in payment setup, isReady=' + isReady + ', hasController=' + !!controller + ', hasSession=' + !!sessionData);

                // If already completed (e.g., via Apple Pay/Google Pay), proceed
                if (isReady) {
                    console.log('Windcave Blocks: Drop-in payment already complete, proceeding');
                    return {
                        type: emitResponse.responseTypes.SUCCESS,
                        meta: {
                            paymentMethodData: {
                                windcave_session_id: sessionData.sessionId,
                                windcave_payment_complete: 'true',
                            },
                        },
                    };
                }

                // Find the drop-in container
                const container = document.getElementById('windcave-blocks-dropin-container');
                if (!container) {
                    console.error('Windcave Blocks: Drop-in container not found');
                    return {
                        type: emitResponse.responseTypes.ERROR,
                        message: settings.i18n.sessionError,
                    };
                }

                // Find the submit button inside the drop-in (it's hidden via CSS)
                // Try various selectors that Windcave drop-in might use
                const submitButton = container.querySelector('button[type="submit"]') ||
                    container.querySelector('[class*="submit"]') ||
                    container.querySelector('[class*="pay-button"]') ||
                    container.querySelector('button');

                if (!submitButton) {
                    console.error('Windcave Blocks: Could not find drop-in submit button');
                    console.log('Windcave Blocks: Container HTML:', container.innerHTML.substring(0, 500));
                    return {
                        type: emitResponse.responseTypes.ERROR,
                        message: settings.i18n.cardError,
                    };
                }

                console.log('Windcave Blocks: Found drop-in button:', submitButton.className || submitButton.tagName);

                // Create a promise that will be resolved when onSuccess fires
                return new Promise((resolve) => {
                    // Store the resolver so onSuccess can call it
                    pendingPaymentRef.current = { resolve };

                    // Set a timeout in case the payment doesn't complete
                    const timeout = setTimeout(() => {
                        if (pendingPaymentRef.current) {
                            console.error('Windcave Blocks: Payment timed out');
                            pendingPaymentRef.current = null;
                            resolve({
                                type: emitResponse.responseTypes.ERROR,
                                message: settings.i18n.paymentError,
                            });
                        }
                    }, 60000); // 60 second timeout

                    // Store timeout so we can clear it on success
                    pendingPaymentRef.current.timeout = timeout;

                    // Temporarily make the button accessible
                    const originalStyles = {
                        position: submitButton.style.position,
                        left: submitButton.style.left,
                        opacity: submitButton.style.opacity,
                        pointerEvents: submitButton.style.pointerEvents,
                        height: submitButton.style.height,
                        width: submitButton.style.width,
                        visibility: submitButton.style.visibility,
                    };

                    submitButton.style.position = 'static';
                    submitButton.style.left = 'auto';
                    submitButton.style.opacity = '1';
                    submitButton.style.pointerEvents = 'auto';
                    submitButton.style.height = 'auto';
                    submitButton.style.width = 'auto';
                    submitButton.style.visibility = 'visible';

                    // Trigger the drop-in submit by clicking its button
                    console.log('Windcave Blocks: Attempting to trigger drop-in submit');

                    // Method 1: Standard click
                    submitButton.click();

                    // Method 2: Dispatch MouseEvent for better compatibility
                    try {
                        const clickEvent = new MouseEvent('click', {
                            view: window,
                            bubbles: true,
                            cancelable: true,
                        });
                        submitButton.dispatchEvent(clickEvent);
                    } catch (e) {
                        console.log('Windcave Blocks: MouseEvent dispatch failed, but click should work');
                    }

                    console.log('Windcave Blocks: Click events dispatched, waiting for onSuccess callback');

                    // Hide it again after a short delay
                    setTimeout(() => {
                        Object.keys(originalStyles).forEach(key => {
                            submitButton.style[key] = originalStyles[key] || '';
                        });
                    }, 200);
                });
            }

            // For Hosted Fields, submit to Windcave
            return new Promise((resolve) => {
                if (!controller || !sessionData.ajaxSubmitUrl) {
                    resolve({
                        type: emitResponse.responseTypes.ERROR,
                        message: settings.i18n.sessionError,
                    });
                    return;
                }

                controller.submit(
                    sessionData.ajaxSubmitUrl,
                    30,
                    (status) => {
                        const statusLower = (status || '').toLowerCase();
                        if (statusLower === 'done' || statusLower === '3dsecure') {
                            resolve({
                                type: emitResponse.responseTypes.SUCCESS,
                                meta: {
                                    paymentMethodData: {
                                        windcave_session_id: sessionData.sessionId,
                                        windcave_payment_complete: 'true',
                                    },
                                },
                            });
                        }
                    },
                    (err) => {
                        console.error('Windcave submit error:', err);
                        resolve({
                            type: emitResponse.responseTypes.ERROR,
                            message: settings.i18n.paymentError,
                        });
                    }
                );
            });
        });

        return () => unsubscribe();
    }, [
        onPaymentSetup,
        emitResponse.responseTypes,
        sessionData,
        controller,
        isReady,
        selectedToken,
    ]);

    // Render saved tokens
    const renderSavedTokens = () => {
        if (!settings.savedTokens || settings.savedTokens.length === 0) {
            return null;
        }

        return createElement(
            'div',
            { className: 'windcave-saved-tokens' },
            settings.savedTokens.map((token) =>
                createElement(
                    'label',
                    {
                        key: token.id,
                        className: 'windcave-saved-token',
                    },
                    createElement('input', {
                        type: 'radio',
                        name: 'windcave-saved-token',
                        value: token.id,
                        checked: selectedToken === token.id,
                        onChange: () => setSelectedToken(token.id),
                    }),
                    createElement(
                        'span',
                        null,
                        `${token.cardType} ending in ${token.last4} (${token.expiryMonth}/${token.expiryYear})`
                    )
                )
            ),
            createElement(
                'label',
                { className: 'windcave-saved-token' },
                createElement('input', {
                    type: 'radio',
                    name: 'windcave-saved-token',
                    value: 'new',
                    checked: selectedToken === null,
                    onChange: () => setSelectedToken(null),
                }),
                createElement('span', null, 'Use a new card')
            )
        );
    };

    // Render payment form
    const renderPaymentForm = () => {
        if (selectedToken) {
            return null;
        }

        if (settings.integrationMode === 'dropin') {
            return createElement('div', {
                id: 'windcave-blocks-dropin-container',
                className: 'windcave-blocks-dropin-container',
            });
        }

        return createElement(
            'div',
            { className: 'windcave-blocks-hosted-fields' },
            createElement(
                'div',
                { className: 'windcave-blocks-field-wrapper' },
                createElement('label', null, settings.i18n.cardNumberLabel),
                createElement('div', {
                    id: 'windcave-blocks-card-number',
                    className: 'windcave-blocks-hosted-field',
                })
            ),
            createElement(
                'div',
                { className: 'windcave-blocks-field-row' },
                createElement(
                    'div',
                    { className: 'windcave-blocks-field-wrapper windcave-blocks-field-half' },
                    createElement('label', null, settings.i18n.expiryLabel),
                    createElement('div', {
                        id: 'windcave-blocks-expiry',
                        className: 'windcave-blocks-hosted-field',
                    })
                ),
                createElement(
                    'div',
                    { className: 'windcave-blocks-field-wrapper windcave-blocks-field-half' },
                    createElement('label', null, settings.i18n.cvvLabel),
                    createElement('div', {
                        id: 'windcave-blocks-cvv',
                        className: 'windcave-blocks-hosted-field',
                    })
                )
            ),
            createElement(
                'div',
                { className: 'windcave-blocks-field-wrapper' },
                createElement('label', null, settings.i18n.cardholderLabel),
                createElement('div', {
                    id: 'windcave-blocks-cardholder',
                    className: 'windcave-blocks-hosted-field',
                })
            )
        );
    };

    return createElement(
        'div',
        { className: 'windcave-blocks-payment-form' },
        settings.description &&
            createElement('p', { className: 'windcave-description' }, settings.description),
        settings.isTestMode &&
            createElement(
                'p',
                { className: 'windcave-test-mode-notice' },
                settings.i18n.testModeNotice
            ),
        error && createElement('p', { className: 'windcave-error' }, error),
        renderSavedTokens(),
        renderPaymentForm()
    );
};

/**
 * Label component
 */
const WindcaveLabel = (props) => {
    const { PaymentMethodLabel } = props.components;

    // Don't show card icons - the drop-in already displays them
    return createElement(PaymentMethodLabel, { text: label });
};

/**
 * Register the payment method
 */
registerPaymentMethod({
    name: 'windcave',
    label: createElement(WindcaveLabel, null),
    content: createElement(WindcaveContent, null),
    edit: createElement(WindcaveContent, null),
    canMakePayment: () => true,
    ariaLabel: label,
    supports: {
        features: settings.supports || ['products'],
    },
});
