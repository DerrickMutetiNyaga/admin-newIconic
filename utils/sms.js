const axios = require('axios');

async function sendSMS(message, phoneNumber) {
    try {
        const formData = new URLSearchParams();
        formData.append('userid', process.env.ZETTATEL_USERNAME);
        formData.append('password', encodeURIComponent(process.env.ZETTATEL_PASSWORD));
        formData.append('sendMethod', 'quick');
        formData.append('mobile', phoneNumber);
        formData.append('msg', message);
        formData.append('senderid', process.env.SENDER_ID);
        formData.append('msgType', 'text');
        formData.append('duplicatecheck', 'true');
        formData.append('output', 'json');

        const response = await axios.post(process.env.ZETTATEL_API_URL, formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        console.log(`SMS sent to ${phoneNumber}:`, response.data);
        return response.data;
    } catch (error) {
        console.error(`Error sending SMS to ${phoneNumber}:`, error.response ? error.response.data : error.message);
        throw error;
    }
}

module.exports = {
    sendSMS
}; 