// MAC Address input formatting
document.addEventListener('DOMContentLoaded', function() {
    const macAddressInput = document.getElementById('macAddress');
    if (macAddressInput) {
        macAddressInput.addEventListener('input', function(e) {
            // Remove any non-alphanumeric characters
            let value = e.target.value.replace(/[^0-9A-Fa-f]/g, '');
            
            // Limit to 12 characters (6 pairs)
            value = value.slice(0, 12);
            
            // Add colons after every 2 characters
            let formattedValue = '';
            for (let i = 0; i < value.length; i++) {
                if (i > 0 && i % 2 === 0) {
                    formattedValue += ':';
                }
                formattedValue += value[i];
            }
            
            // Update input value
            e.target.value = formattedValue;
            
            // Add visual feedback for valid/invalid format
            const isValid = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(formattedValue);
            e.target.style.borderColor = isValid ? '#28a745' : '#dc3545';
            
            // Add/remove error message
            let errorMsg = e.target.parentElement.querySelector('.mac-error');
            if (!isValid && formattedValue.length > 0) {
                if (!errorMsg) {
                    errorMsg = document.createElement('div');
                    errorMsg.className = 'mac-error';
                    errorMsg.style.color = '#dc3545';
                    errorMsg.style.fontSize = '0.8rem';
                    errorMsg.style.marginTop = '0.25rem';
                    e.target.parentElement.appendChild(errorMsg);
                }
                errorMsg.textContent = 'MAC address must be in format: XX:XX:XX:XX:XX:XX';
            } else if (errorMsg) {
                errorMsg.remove();
            }
        });

        // Prevent paste of invalid characters
        macAddressInput.addEventListener('paste', function(e) {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            const cleanText = pastedText.replace(/[^0-9A-Fa-f]/g, '').slice(0, 12);
            
            // Trigger input event with cleaned text
            const inputEvent = new Event('input', { bubbles: true });
            macAddressInput.value = cleanText;
            macAddressInput.dispatchEvent(inputEvent);
        });

        // Convert to uppercase on blur
        macAddressInput.addEventListener('blur', function(e) {
            e.target.value = e.target.value.toUpperCase();
        });
    }
}); 