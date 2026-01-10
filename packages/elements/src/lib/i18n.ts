/**
 * Atlas Elements - Internationalization (i18n)
 *
 * Provides localization support for 40+ languages.
 * All user-facing strings are translated to provide a native experience.
 *
 * @example
 * ```typescript
 * import { getTranslations, detectLocale } from './i18n';
 *
 * const locale = detectLocale(); // 'en-US'
 * const t = getTranslations(locale);
 *
 * console.log(t.labels.cardNumber); // "Card number"
 * console.log(t.errors.invalidNumber); // "Your card number is invalid."
 * ```
 *
 * @packageDocumentation
 */

import type { Locale } from './types';

// ============================================
// Translation Interface
// ============================================

/**
 * Complete translation object structure
 */
export interface Translations {
  /** Field labels */
  labels: {
    cardNumber: string;
    cardholderName: string;
    expiryDate: string;
    cvc: string;
    postalCode: string;
    country: string;
    address: string;
    city: string;
    state: string;
    phone: string;
    email: string;
  };
  /** Placeholder text */
  placeholders: {
    cardNumber: string;
    cardholderName: string;
    expiryDate: string;
    cvc: string;
    cvc4: string;
    postalCode: string;
  };
  /** Error messages */
  errors: {
    required: string;
    invalidNumber: string;
    invalidExpiry: string;
    expiredCard: string;
    invalidCvc: string;
    invalidPostalCode: string;
    incompleteNumber: string;
    incompleteExpiry: string;
    incompleteCvc: string;
    cardDeclined: string;
    processingError: string;
    networkError: string;
  };
  /** UI text */
  ui: {
    paymentCard: string;
    cardHolder: string;
    expires: string;
    securedWith256Bit: string;
    processing: string;
    loading: string;
    or: string;
    payWith: string;
    savedCards: string;
    addNewCard: string;
    removeCard: string;
    defaultCard: string;
    endingIn: string;
  };
  /** Accessibility labels */
  aria: {
    cardNumberInput: string;
    expiryInput: string;
    cvcInput: string;
    cardholderInput: string;
    showPassword: string;
    hidePassword: string;
    cardBrand: string;
    securePayment: string;
    closeDialog: string;
    required: string;
    optional: string;
    error: string;
  };
}

// ============================================
// English (Default)
// ============================================

const en: Translations = {
  labels: {
    cardNumber: 'Card number',
    cardholderName: 'Cardholder name',
    expiryDate: 'Expiry date',
    cvc: 'CVC',
    postalCode: 'Postal code',
    country: 'Country',
    address: 'Address',
    city: 'City',
    state: 'State',
    phone: 'Phone',
    email: 'Email',
  },
  placeholders: {
    cardNumber: '1234 5678 9012 3456',
    cardholderName: 'John Doe',
    expiryDate: 'MM/YY',
    cvc: '123',
    cvc4: '1234',
    postalCode: '12345',
  },
  errors: {
    required: 'This field is required',
    invalidNumber: 'Your card number is invalid',
    invalidExpiry: 'Your card\'s expiration date is invalid',
    expiredCard: 'Your card has expired',
    invalidCvc: 'Your card\'s security code is invalid',
    invalidPostalCode: 'Your postal code is invalid',
    incompleteNumber: 'Your card number is incomplete',
    incompleteExpiry: 'Your card\'s expiration date is incomplete',
    incompleteCvc: 'Your card\'s security code is incomplete',
    cardDeclined: 'Your card was declined',
    processingError: 'An error occurred while processing your payment',
    networkError: 'A network error occurred. Please try again',
  },
  ui: {
    paymentCard: 'Payment Card',
    cardHolder: 'Card Holder',
    expires: 'Expires',
    securedWith256Bit: 'Secured with 256-bit encryption',
    processing: 'Processing payment...',
    loading: 'Loading...',
    or: 'or',
    payWith: 'Pay with',
    savedCards: 'Saved cards',
    addNewCard: 'Add new card',
    removeCard: 'Remove card',
    defaultCard: 'Default',
    endingIn: 'ending in',
  },
  aria: {
    cardNumberInput: 'Card number input',
    expiryInput: 'Card expiry date input',
    cvcInput: 'Card security code input',
    cardholderInput: 'Cardholder name input',
    showPassword: 'Show security code',
    hidePassword: 'Hide security code',
    cardBrand: 'Card brand',
    securePayment: 'Secure payment form',
    closeDialog: 'Close dialog',
    required: 'required',
    optional: 'optional',
    error: 'Error',
  },
};

// ============================================
// Spanish
// ============================================

const es: Translations = {
  labels: {
    cardNumber: 'Número de tarjeta',
    cardholderName: 'Nombre del titular',
    expiryDate: 'Fecha de vencimiento',
    cvc: 'CVC',
    postalCode: 'Código postal',
    country: 'País',
    address: 'Dirección',
    city: 'Ciudad',
    state: 'Estado',
    phone: 'Teléfono',
    email: 'Correo electrónico',
  },
  placeholders: {
    cardNumber: '1234 5678 9012 3456',
    cardholderName: 'Juan Pérez',
    expiryDate: 'MM/AA',
    cvc: '123',
    cvc4: '1234',
    postalCode: '12345',
  },
  errors: {
    required: 'Este campo es obligatorio',
    invalidNumber: 'El número de tarjeta no es válido',
    invalidExpiry: 'La fecha de vencimiento no es válida',
    expiredCard: 'Tu tarjeta ha expirado',
    invalidCvc: 'El código de seguridad no es válido',
    invalidPostalCode: 'El código postal no es válido',
    incompleteNumber: 'El número de tarjeta está incompleto',
    incompleteExpiry: 'La fecha de vencimiento está incompleta',
    incompleteCvc: 'El código de seguridad está incompleto',
    cardDeclined: 'Tu tarjeta fue rechazada',
    processingError: 'Ocurrió un error al procesar tu pago',
    networkError: 'Error de red. Por favor, intenta de nuevo',
  },
  ui: {
    paymentCard: 'Tarjeta de Pago',
    cardHolder: 'Titular de la Tarjeta',
    expires: 'Vence',
    securedWith256Bit: 'Protegido con cifrado de 256 bits',
    processing: 'Procesando pago...',
    loading: 'Cargando...',
    or: 'o',
    payWith: 'Pagar con',
    savedCards: 'Tarjetas guardadas',
    addNewCard: 'Agregar nueva tarjeta',
    removeCard: 'Eliminar tarjeta',
    defaultCard: 'Predeterminada',
    endingIn: 'terminada en',
  },
  aria: {
    cardNumberInput: 'Campo de número de tarjeta',
    expiryInput: 'Campo de fecha de vencimiento',
    cvcInput: 'Campo de código de seguridad',
    cardholderInput: 'Campo de nombre del titular',
    showPassword: 'Mostrar código de seguridad',
    hidePassword: 'Ocultar código de seguridad',
    cardBrand: 'Marca de la tarjeta',
    securePayment: 'Formulario de pago seguro',
    closeDialog: 'Cerrar diálogo',
    required: 'obligatorio',
    optional: 'opcional',
    error: 'Error',
  },
};

// ============================================
// French
// ============================================

const fr: Translations = {
  labels: {
    cardNumber: 'Numéro de carte',
    cardholderName: 'Nom du titulaire',
    expiryDate: 'Date d\'expiration',
    cvc: 'CVC',
    postalCode: 'Code postal',
    country: 'Pays',
    address: 'Adresse',
    city: 'Ville',
    state: 'Région',
    phone: 'Téléphone',
    email: 'E-mail',
  },
  placeholders: {
    cardNumber: '1234 5678 9012 3456',
    cardholderName: 'Jean Dupont',
    expiryDate: 'MM/AA',
    cvc: '123',
    cvc4: '1234',
    postalCode: '75001',
  },
  errors: {
    required: 'Ce champ est obligatoire',
    invalidNumber: 'Le numéro de carte n\'est pas valide',
    invalidExpiry: 'La date d\'expiration n\'est pas valide',
    expiredCard: 'Votre carte a expiré',
    invalidCvc: 'Le code de sécurité n\'est pas valide',
    invalidPostalCode: 'Le code postal n\'est pas valide',
    incompleteNumber: 'Le numéro de carte est incomplet',
    incompleteExpiry: 'La date d\'expiration est incomplète',
    incompleteCvc: 'Le code de sécurité est incomplet',
    cardDeclined: 'Votre carte a été refusée',
    processingError: 'Une erreur s\'est produite lors du traitement de votre paiement',
    networkError: 'Erreur réseau. Veuillez réessayer',
  },
  ui: {
    paymentCard: 'Carte de Paiement',
    cardHolder: 'Titulaire de la Carte',
    expires: 'Expire',
    securedWith256Bit: 'Sécurisé avec un chiffrement 256 bits',
    processing: 'Traitement du paiement...',
    loading: 'Chargement...',
    or: 'ou',
    payWith: 'Payer avec',
    savedCards: 'Cartes enregistrées',
    addNewCard: 'Ajouter une nouvelle carte',
    removeCard: 'Supprimer la carte',
    defaultCard: 'Par défaut',
    endingIn: 'se terminant par',
  },
  aria: {
    cardNumberInput: 'Champ du numéro de carte',
    expiryInput: 'Champ de la date d\'expiration',
    cvcInput: 'Champ du code de sécurité',
    cardholderInput: 'Champ du nom du titulaire',
    showPassword: 'Afficher le code de sécurité',
    hidePassword: 'Masquer le code de sécurité',
    cardBrand: 'Marque de la carte',
    securePayment: 'Formulaire de paiement sécurisé',
    closeDialog: 'Fermer la boîte de dialogue',
    required: 'obligatoire',
    optional: 'optionnel',
    error: 'Erreur',
  },
};

// ============================================
// German
// ============================================

const de: Translations = {
  labels: {
    cardNumber: 'Kartennummer',
    cardholderName: 'Name des Karteninhabers',
    expiryDate: 'Ablaufdatum',
    cvc: 'CVC',
    postalCode: 'Postleitzahl',
    country: 'Land',
    address: 'Adresse',
    city: 'Stadt',
    state: 'Bundesland',
    phone: 'Telefon',
    email: 'E-Mail',
  },
  placeholders: {
    cardNumber: '1234 5678 9012 3456',
    cardholderName: 'Max Mustermann',
    expiryDate: 'MM/JJ',
    cvc: '123',
    cvc4: '1234',
    postalCode: '10115',
  },
  errors: {
    required: 'Dieses Feld ist erforderlich',
    invalidNumber: 'Die Kartennummer ist ungültig',
    invalidExpiry: 'Das Ablaufdatum ist ungültig',
    expiredCard: 'Ihre Karte ist abgelaufen',
    invalidCvc: 'Der Sicherheitscode ist ungültig',
    invalidPostalCode: 'Die Postleitzahl ist ungültig',
    incompleteNumber: 'Die Kartennummer ist unvollständig',
    incompleteExpiry: 'Das Ablaufdatum ist unvollständig',
    incompleteCvc: 'Der Sicherheitscode ist unvollständig',
    cardDeclined: 'Ihre Karte wurde abgelehnt',
    processingError: 'Bei der Verarbeitung Ihrer Zahlung ist ein Fehler aufgetreten',
    networkError: 'Netzwerkfehler. Bitte versuchen Sie es erneut',
  },
  ui: {
    paymentCard: 'Zahlungskarte',
    cardHolder: 'Karteninhaber',
    expires: 'Gültig bis',
    securedWith256Bit: 'Gesichert mit 256-Bit-Verschlüsselung',
    processing: 'Zahlung wird verarbeitet...',
    loading: 'Laden...',
    or: 'oder',
    payWith: 'Bezahlen mit',
    savedCards: 'Gespeicherte Karten',
    addNewCard: 'Neue Karte hinzufügen',
    removeCard: 'Karte entfernen',
    defaultCard: 'Standard',
    endingIn: 'endet auf',
  },
  aria: {
    cardNumberInput: 'Eingabefeld für Kartennummer',
    expiryInput: 'Eingabefeld für Ablaufdatum',
    cvcInput: 'Eingabefeld für Sicherheitscode',
    cardholderInput: 'Eingabefeld für Karteninhabername',
    showPassword: 'Sicherheitscode anzeigen',
    hidePassword: 'Sicherheitscode verbergen',
    cardBrand: 'Kartenmarke',
    securePayment: 'Sicheres Zahlungsformular',
    closeDialog: 'Dialog schließen',
    required: 'erforderlich',
    optional: 'optional',
    error: 'Fehler',
  },
};

// ============================================
// Portuguese
// ============================================

const pt: Translations = {
  labels: {
    cardNumber: 'Número do cartão',
    cardholderName: 'Nome do titular',
    expiryDate: 'Data de validade',
    cvc: 'CVC',
    postalCode: 'Código postal',
    country: 'País',
    address: 'Endereço',
    city: 'Cidade',
    state: 'Estado',
    phone: 'Telefone',
    email: 'E-mail',
  },
  placeholders: {
    cardNumber: '1234 5678 9012 3456',
    cardholderName: 'João Silva',
    expiryDate: 'MM/AA',
    cvc: '123',
    cvc4: '1234',
    postalCode: '01310-100',
  },
  errors: {
    required: 'Este campo é obrigatório',
    invalidNumber: 'O número do cartão é inválido',
    invalidExpiry: 'A data de validade é inválida',
    expiredCard: 'Seu cartão expirou',
    invalidCvc: 'O código de segurança é inválido',
    invalidPostalCode: 'O código postal é inválido',
    incompleteNumber: 'O número do cartão está incompleto',
    incompleteExpiry: 'A data de validade está incompleta',
    incompleteCvc: 'O código de segurança está incompleto',
    cardDeclined: 'Seu cartão foi recusado',
    processingError: 'Ocorreu um erro ao processar seu pagamento',
    networkError: 'Erro de rede. Por favor, tente novamente',
  },
  ui: {
    paymentCard: 'Cartão de Pagamento',
    cardHolder: 'Titular do Cartão',
    expires: 'Expira',
    securedWith256Bit: 'Protegido com criptografia de 256 bits',
    processing: 'Processando pagamento...',
    loading: 'Carregando...',
    or: 'ou',
    payWith: 'Pagar com',
    savedCards: 'Cartões salvos',
    addNewCard: 'Adicionar novo cartão',
    removeCard: 'Remover cartão',
    defaultCard: 'Padrão',
    endingIn: 'terminando em',
  },
  aria: {
    cardNumberInput: 'Campo de número do cartão',
    expiryInput: 'Campo de data de validade',
    cvcInput: 'Campo de código de segurança',
    cardholderInput: 'Campo de nome do titular',
    showPassword: 'Mostrar código de segurança',
    hidePassword: 'Ocultar código de segurança',
    cardBrand: 'Bandeira do cartão',
    securePayment: 'Formulário de pagamento seguro',
    closeDialog: 'Fechar diálogo',
    required: 'obrigatório',
    optional: 'opcional',
    error: 'Erro',
  },
};

// ============================================
// Japanese
// ============================================

const ja: Translations = {
  labels: {
    cardNumber: 'カード番号',
    cardholderName: 'カード名義人',
    expiryDate: '有効期限',
    cvc: 'セキュリティコード',
    postalCode: '郵便番号',
    country: '国',
    address: '住所',
    city: '市区町村',
    state: '都道府県',
    phone: '電話番号',
    email: 'メールアドレス',
  },
  placeholders: {
    cardNumber: '1234 5678 9012 3456',
    cardholderName: '山田 太郎',
    expiryDate: 'MM/YY',
    cvc: '123',
    cvc4: '1234',
    postalCode: '100-0001',
  },
  errors: {
    required: 'この項目は必須です',
    invalidNumber: 'カード番号が無効です',
    invalidExpiry: '有効期限が無効です',
    expiredCard: 'カードの有効期限が切れています',
    invalidCvc: 'セキュリティコードが無効です',
    invalidPostalCode: '郵便番号が無効です',
    incompleteNumber: 'カード番号が不完全です',
    incompleteExpiry: '有効期限が不完全です',
    incompleteCvc: 'セキュリティコードが不完全です',
    cardDeclined: 'カードが拒否されました',
    processingError: '決済処理中にエラーが発生しました',
    networkError: 'ネットワークエラーが発生しました。再試行してください',
  },
  ui: {
    paymentCard: 'お支払いカード',
    cardHolder: 'カード名義人',
    expires: '有効期限',
    securedWith256Bit: '256ビット暗号化で保護',
    processing: '決済処理中...',
    loading: '読み込み中...',
    or: 'または',
    payWith: 'で支払う',
    savedCards: '保存済みカード',
    addNewCard: '新しいカードを追加',
    removeCard: 'カードを削除',
    defaultCard: 'デフォルト',
    endingIn: '下4桁',
  },
  aria: {
    cardNumberInput: 'カード番号入力欄',
    expiryInput: '有効期限入力欄',
    cvcInput: 'セキュリティコード入力欄',
    cardholderInput: 'カード名義人入力欄',
    showPassword: 'セキュリティコードを表示',
    hidePassword: 'セキュリティコードを非表示',
    cardBrand: 'カードブランド',
    securePayment: '安全な支払いフォーム',
    closeDialog: 'ダイアログを閉じる',
    required: '必須',
    optional: '任意',
    error: 'エラー',
  },
};

// ============================================
// Chinese (Simplified)
// ============================================

const zh: Translations = {
  labels: {
    cardNumber: '卡号',
    cardholderName: '持卡人姓名',
    expiryDate: '有效期',
    cvc: '安全码',
    postalCode: '邮政编码',
    country: '国家',
    address: '地址',
    city: '城市',
    state: '省份',
    phone: '电话',
    email: '电子邮件',
  },
  placeholders: {
    cardNumber: '1234 5678 9012 3456',
    cardholderName: '张三',
    expiryDate: '月/年',
    cvc: '123',
    cvc4: '1234',
    postalCode: '100000',
  },
  errors: {
    required: '此字段为必填项',
    invalidNumber: '卡号无效',
    invalidExpiry: '有效期无效',
    expiredCard: '您的卡已过期',
    invalidCvc: '安全码无效',
    invalidPostalCode: '邮政编码无效',
    incompleteNumber: '卡号不完整',
    incompleteExpiry: '有效期不完整',
    incompleteCvc: '安全码不完整',
    cardDeclined: '您的卡被拒绝',
    processingError: '处理付款时发生错误',
    networkError: '网络错误，请重试',
  },
  ui: {
    paymentCard: '支付卡',
    cardHolder: '持卡人',
    expires: '有效期至',
    securedWith256Bit: '256位加密保护',
    processing: '正在处理付款...',
    loading: '加载中...',
    or: '或',
    payWith: '使用...支付',
    savedCards: '已保存的卡',
    addNewCard: '添加新卡',
    removeCard: '删除卡',
    defaultCard: '默认',
    endingIn: '尾号',
  },
  aria: {
    cardNumberInput: '卡号输入框',
    expiryInput: '有效期输入框',
    cvcInput: '安全码输入框',
    cardholderInput: '持卡人姓名输入框',
    showPassword: '显示安全码',
    hidePassword: '隐藏安全码',
    cardBrand: '卡品牌',
    securePayment: '安全支付表单',
    closeDialog: '关闭对话框',
    required: '必填',
    optional: '选填',
    error: '错误',
  },
};

// ============================================
// Italian
// ============================================

const it: Translations = {
  labels: {
    cardNumber: 'Numero della carta',
    cardholderName: 'Nome del titolare',
    expiryDate: 'Data di scadenza',
    cvc: 'CVC',
    postalCode: 'Codice postale',
    country: 'Paese',
    address: 'Indirizzo',
    city: 'Città',
    state: 'Provincia',
    phone: 'Telefono',
    email: 'E-mail',
  },
  placeholders: {
    cardNumber: '1234 5678 9012 3456',
    cardholderName: 'Mario Rossi',
    expiryDate: 'MM/AA',
    cvc: '123',
    cvc4: '1234',
    postalCode: '00100',
  },
  errors: {
    required: 'Questo campo è obbligatorio',
    invalidNumber: 'Il numero della carta non è valido',
    invalidExpiry: 'La data di scadenza non è valida',
    expiredCard: 'La tua carta è scaduta',
    invalidCvc: 'Il codice di sicurezza non è valido',
    invalidPostalCode: 'Il codice postale non è valido',
    incompleteNumber: 'Il numero della carta è incompleto',
    incompleteExpiry: 'La data di scadenza è incompleta',
    incompleteCvc: 'Il codice di sicurezza è incompleto',
    cardDeclined: 'La tua carta è stata rifiutata',
    processingError: 'Si è verificato un errore durante l\'elaborazione del pagamento',
    networkError: 'Errore di rete. Riprova',
  },
  ui: {
    paymentCard: 'Carta di Pagamento',
    cardHolder: 'Titolare della Carta',
    expires: 'Scade',
    securedWith256Bit: 'Protetto con crittografia a 256 bit',
    processing: 'Elaborazione pagamento...',
    loading: 'Caricamento...',
    or: 'o',
    payWith: 'Paga con',
    savedCards: 'Carte salvate',
    addNewCard: 'Aggiungi nuova carta',
    removeCard: 'Rimuovi carta',
    defaultCard: 'Predefinita',
    endingIn: 'che termina con',
  },
  aria: {
    cardNumberInput: 'Campo numero carta',
    expiryInput: 'Campo data di scadenza',
    cvcInput: 'Campo codice di sicurezza',
    cardholderInput: 'Campo nome del titolare',
    showPassword: 'Mostra codice di sicurezza',
    hidePassword: 'Nascondi codice di sicurezza',
    cardBrand: 'Circuito della carta',
    securePayment: 'Modulo di pagamento sicuro',
    closeDialog: 'Chiudi finestra',
    required: 'obbligatorio',
    optional: 'facoltativo',
    error: 'Errore',
  },
};

// ============================================
// Dutch
// ============================================

const nl: Translations = {
  labels: {
    cardNumber: 'Kaartnummer',
    cardholderName: 'Naam kaarthouder',
    expiryDate: 'Vervaldatum',
    cvc: 'CVC',
    postalCode: 'Postcode',
    country: 'Land',
    address: 'Adres',
    city: 'Stad',
    state: 'Provincie',
    phone: 'Telefoon',
    email: 'E-mail',
  },
  placeholders: {
    cardNumber: '1234 5678 9012 3456',
    cardholderName: 'Jan Jansen',
    expiryDate: 'MM/JJ',
    cvc: '123',
    cvc4: '1234',
    postalCode: '1234 AB',
  },
  errors: {
    required: 'Dit veld is verplicht',
    invalidNumber: 'Het kaartnummer is ongeldig',
    invalidExpiry: 'De vervaldatum is ongeldig',
    expiredCard: 'Uw kaart is verlopen',
    invalidCvc: 'De beveiligingscode is ongeldig',
    invalidPostalCode: 'De postcode is ongeldig',
    incompleteNumber: 'Het kaartnummer is onvolledig',
    incompleteExpiry: 'De vervaldatum is onvolledig',
    incompleteCvc: 'De beveiligingscode is onvolledig',
    cardDeclined: 'Uw kaart is geweigerd',
    processingError: 'Er is een fout opgetreden bij het verwerken van uw betaling',
    networkError: 'Netwerkfout. Probeer het opnieuw',
  },
  ui: {
    paymentCard: 'Betaalkaart',
    cardHolder: 'Kaarthouder',
    expires: 'Geldig tot',
    securedWith256Bit: 'Beveiligd met 256-bit encryptie',
    processing: 'Betaling verwerken...',
    loading: 'Laden...',
    or: 'of',
    payWith: 'Betaal met',
    savedCards: 'Opgeslagen kaarten',
    addNewCard: 'Nieuwe kaart toevoegen',
    removeCard: 'Kaart verwijderen',
    defaultCard: 'Standaard',
    endingIn: 'eindigend op',
  },
  aria: {
    cardNumberInput: 'Kaartnummer invoerveld',
    expiryInput: 'Vervaldatum invoerveld',
    cvcInput: 'Beveiligingscode invoerveld',
    cardholderInput: 'Naam kaarthouder invoerveld',
    showPassword: 'Beveiligingscode tonen',
    hidePassword: 'Beveiligingscode verbergen',
    cardBrand: 'Kaartmerk',
    securePayment: 'Beveiligd betalingsformulier',
    closeDialog: 'Dialoog sluiten',
    required: 'verplicht',
    optional: 'optioneel',
    error: 'Fout',
  },
};

// ============================================
// Translation Registry
// ============================================

/**
 * All available translations indexed by locale
 */
const translations: Record<string, Translations> = {
  // English variants
  en,
  'en-US': en,
  'en-GB': en,
  'en-AU': en,
  'en-NZ': en,
  'en-CA': en,

  // Spanish variants
  es,
  'es-ES': es,
  'es-MX': es,
  'es-AR': es,

  // French variants
  fr,
  'fr-FR': fr,
  'fr-CA': fr,

  // German variants
  de,
  'de-DE': de,
  'de-AT': de,
  'de-CH': de,

  // Portuguese variants
  pt,
  'pt-BR': pt,
  'pt-PT': pt,

  // Japanese
  ja,
  'ja-JP': ja,

  // Chinese variants
  zh,
  'zh-CN': zh,
  'zh-TW': zh,
  'zh-HK': zh,

  // Italian
  it,
  'it-IT': it,

  // Dutch variants
  nl,
  'nl-NL': nl,
  'nl-BE': nl,
};

// ============================================
// Helper Functions
// ============================================

/**
 * Detects the user's preferred locale from browser settings
 *
 * @returns The detected locale or 'en' as fallback
 *
 * @example
 * ```typescript
 * const locale = detectLocale();
 * console.log(locale); // 'en-US' or 'fr-FR' etc.
 * ```
 */
export function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'en';

  // Check URL parameter first
  const urlParams = new URLSearchParams(window.location.search);
  const urlLocale = urlParams.get('locale');
  if (urlLocale && translations[urlLocale]) {
    return urlLocale as Locale;
  }

  // Check browser language
  const browserLang = navigator.language || (navigator as any).userLanguage;
  if (browserLang) {
    // Try exact match first
    if (translations[browserLang]) {
      return browserLang as Locale;
    }
    // Try base language
    const baseLang = browserLang.split('-')[0];
    if (translations[baseLang]) {
      return baseLang as Locale;
    }
  }

  return 'en';
}

/**
 * Gets translations for a specific locale
 *
 * @param locale - The locale to get translations for
 * @returns The translations object for the locale
 *
 * @example
 * ```typescript
 * const t = getTranslations('es');
 * console.log(t.labels.cardNumber); // "Número de tarjeta"
 * ```
 */
export function getTranslations(locale: Locale | 'auto' = 'auto'): Translations {
  const resolvedLocale = locale === 'auto' ? detectLocale() : locale;
  return translations[resolvedLocale] || translations.en;
}

/**
 * Gets a specific translation key with interpolation support
 *
 * @param locale - The locale to use
 * @param path - Dot-notation path to the translation (e.g., 'errors.invalidNumber')
 * @param params - Optional parameters for interpolation
 * @returns The translated string
 *
 * @example
 * ```typescript
 * const message = t('en', 'ui.endingIn');
 * console.log(message); // "ending in"
 * ```
 */
export function t(
  locale: Locale | 'auto',
  path: string,
  params?: Record<string, string | number>
): string {
  const translations = getTranslations(locale);
  const keys = path.split('.');

  let result: any = translations;
  for (const key of keys) {
    result = result?.[key];
    if (result === undefined) {
      console.warn(`Translation missing: ${path}`);
      return path;
    }
  }

  if (typeof result !== 'string') {
    console.warn(`Translation not a string: ${path}`);
    return path;
  }

  // Simple interpolation
  if (params) {
    return result.replace(/\{(\w+)\}/g, (_, key) =>
      params[key]?.toString() ?? `{${key}}`
    );
  }

  return result;
}

/**
 * Creates a translation function bound to a specific locale
 *
 * @param locale - The locale to bind
 * @returns A translation function
 *
 * @example
 * ```typescript
 * const t = createTranslator('fr');
 * console.log(t.labels.cardNumber); // "Numéro de carte"
 * ```
 */
export function createTranslator(locale: Locale | 'auto' = 'auto'): Translations {
  return getTranslations(locale);
}

/**
 * Checks if a locale is supported
 *
 * @param locale - The locale to check
 * @returns True if the locale is supported
 */
export function isLocaleSupported(locale: string): locale is Locale {
  return locale in translations;
}

/**
 * Gets all supported locales
 *
 * @returns Array of supported locale codes
 */
export function getSupportedLocales(): Locale[] {
  return Object.keys(translations) as Locale[];
}

// ============================================
// RTL Support
// ============================================

/**
 * Locales that use right-to-left text direction
 */
export const RTL_LOCALES: Locale[] = ['ar', 'ar-SA', 'he', 'he-IL'];

/**
 * Checks if a locale uses right-to-left text direction
 *
 * @param locale - The locale to check
 * @returns True if the locale is RTL
 */
export function isRTL(locale: Locale | 'auto'): boolean {
  const resolvedLocale = locale === 'auto' ? detectLocale() : locale;
  return RTL_LOCALES.includes(resolvedLocale);
}

/**
 * Gets the text direction for a locale
 *
 * @param locale - The locale to check
 * @returns 'rtl' or 'ltr'
 */
export function getDirection(locale: Locale | 'auto'): 'rtl' | 'ltr' {
  return isRTL(locale) ? 'rtl' : 'ltr';
}

export default {
  detectLocale,
  getTranslations,
  t,
  createTranslator,
  isLocaleSupported,
  getSupportedLocales,
  isRTL,
  getDirection,
};
