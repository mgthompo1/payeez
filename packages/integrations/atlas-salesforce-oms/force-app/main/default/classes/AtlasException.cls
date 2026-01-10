/**
 * AtlasException
 * Custom exception for Atlas integration errors
 */
public class AtlasException extends Exception {

    public String errorCode;
    public String errorDetail;

    /**
     * Constructor with message
     */
    public AtlasException(String message) {
        this.setMessage(message);
    }

    /**
     * Constructor with code and message
     */
    public AtlasException(String code, String message) {
        this.errorCode = code;
        this.setMessage(message);
    }

    /**
     * Constructor with full details
     */
    public AtlasException(String code, String message, String detail) {
        this.errorCode = code;
        this.errorDetail = detail;
        this.setMessage(message);
    }

    /**
     * Get formatted error string
     */
    public String getFormattedError() {
        String result = '';
        if (String.isNotBlank(errorCode)) {
            result += '[' + errorCode + '] ';
        }
        result += getMessage();
        if (String.isNotBlank(errorDetail)) {
            result += ' - ' + errorDetail;
        }
        return result;
    }
}
