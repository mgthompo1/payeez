import { LightningElement, api, track, wire } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';

import PAYEEZ_SDK from '@salesforce/resourceUrl/PayeezSDK';

import createSession from '@salesforce/apex/PayeezPaymentController.createSession';
import confirmPayment from '@salesforce/apex/PayeezPaymentController.confirmPayment';
import getSavedCards from '@salesforce/apex/PayeezPaymentController.getSavedCards';
import getConfig from '@salesforce/apex/PayeezPaymentController.getConfig';

export default class PayeezPayment extends LightningElement {
    @api recordId;
    @api objectApiName;

    @track isLoading = true;
    @track isProcessing = false;
    @track errorMessage;
    @track successMessage;
    @track cardError;

    @track orderNumber;
    @track formattedAmount;
    @track isTestMode = false;
    @track isLoggedIn = false;
    @track saveCard = false;
    @track paymentComplete = false;
    @track transactionId;

    @track savedCards = [];
    @track selectedCard = 'new';

    payeez;
    elements;
    cardElement;
    config;

    get hasSavedCards() {
        return this.savedCards && this.savedCards.length > 0;
    }

    get showCardForm() {
        return this.selectedCard === 'new';
    }

    get savedCardOptions() {
        const options = this.savedCards.map(card => ({
            label: `${card.brand} •••• ${card.last4} (${card.expiryMonth}/${card.expiryYear})`,
            value: card.id
        }));
        options.push({ label: 'Use a new card', value: 'new' });
        return options;
    }

    async connectedCallback() {
        try {
            // Load config
            this.config = await getConfig();
            this.isTestMode = this.config.isTestMode;

            // Load Payeez SDK
            await loadScript(this, PAYEEZ_SDK);

            // Initialize Payeez
            this.payeez = window.Payeez(this.config.publicKey, {
                environment: this.config.isTestMode ? 'sandbox' : 'production'
            });
            this.elements = this.payeez.elements();

            // Load saved cards if logged in
            if (this.config.isLoggedIn) {
                this.isLoggedIn = true;
                await this.loadSavedCards();
            }

            // Mount card element
            this.mountCardElement();

            this.isLoading = false;
        } catch (error) {
            this.errorMessage = error.body?.message || error.message || 'Failed to initialize payment';
            this.isLoading = false;
        }
    }

    async loadSavedCards() {
        try {
            this.savedCards = await getSavedCards();
        } catch (error) {
            console.error('Failed to load saved cards:', error);
        }
    }

    mountCardElement() {
        const container = this.template.querySelector('[data-id="card-element"]');
        if (!container) return;

        this.cardElement = this.elements.create('card', {
            style: {
                base: {
                    fontSize: '16px',
                    color: '#16325c',
                    fontFamily: '"Salesforce Sans", Arial, sans-serif'
                },
                invalid: {
                    color: '#c23934'
                }
            }
        });

        this.cardElement.mount(container);

        this.cardElement.on('change', (event) => {
            this.cardError = event.error ? event.error.message : '';
        });
    }

    handleCardSelection(event) {
        this.selectedCard = event.detail.value;
        if (this.selectedCard === 'new' && !this.cardElement) {
            // Re-mount card element if needed
            setTimeout(() => this.mountCardElement(), 0);
        }
    }

    handleSaveCardChange(event) {
        this.saveCard = event.target.checked;
    }

    async handlePayment() {
        this.isProcessing = true;
        this.errorMessage = null;

        try {
            // Create session
            const sessionResult = await createSession({
                recordId: this.recordId,
                objectApiName: this.objectApiName,
                saveCard: this.saveCard
            });

            if (!sessionResult.success) {
                throw new Error(sessionResult.errorMessage);
            }

            let paymentResult;

            if (this.selectedCard !== 'new') {
                // Use saved card
                paymentResult = await this.payeez.confirmPayment(sessionResult.sessionId, {
                    payment_method: this.selectedCard
                });
            } else {
                // Use new card
                paymentResult = await this.payeez.confirmPayment(sessionResult.sessionId, {
                    payment_method: {
                        card: this.cardElement
                    }
                });
            }

            if (paymentResult.error) {
                throw new Error(paymentResult.error.message);
            }

            if (paymentResult.requiresAction) {
                // Handle 3DS
                paymentResult = await this.payeez.handleNextAction(paymentResult);
                if (paymentResult.error) {
                    throw new Error(paymentResult.error.message);
                }
            }

            // Confirm on backend
            const confirmResult = await confirmPayment({
                sessionId: sessionResult.sessionId,
                recordId: this.recordId
            });

            if (confirmResult.success) {
                this.paymentComplete = true;
                this.transactionId = confirmResult.transactionId;
                this.showToast('Success', 'Payment completed successfully', 'success');
            } else {
                throw new Error(confirmResult.errorMessage || 'Payment confirmation failed');
            }

        } catch (error) {
            this.errorMessage = error.body?.message || error.message || 'Payment failed';
            this.showToast('Error', this.errorMessage, 'error');
        } finally {
            this.isProcessing = false;
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({
            title,
            message,
            variant
        }));
    }
}
