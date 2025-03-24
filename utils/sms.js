const axios = require('axios');
const qs = require('querystring');

const sendSMS = async (phoneNumbers, message) => {
    try {
        const username = process.env.ZETTATEL_USERNAME;
        const password = process.env.ZETTATEL_PASSWORD;
        const senderId = process.env.SENDER_ID;

        // Split phone numbers if multiple are provided
        const numbers = phoneNumbers.split(',').map(num => num.trim());

        // Send SMS to each number
        for (const number of numbers) {
            const data = {
                userid: username,
                password: password,
                sendMethod: 'quick',
                mobile: number,
                msg: message,
                senderid: senderId,
                msgType: 'text',
                duplicatecheck: 'true',
                output: 'json'
            };

            const response = await axios.post('https://portal.zettatel.com/SMSApi/send', 
                qs.stringify(data),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            if (response.data.status !== 'success') {
                console.error(`Failed to send SMS to ${number}:`, response.data);
            } else {
                console.log(`SMS sent successfully to ${number}:`, response.data);
            }
        }

        return true;
    } catch (error) {
        console.error('Error sending SMS:', error);
        return false;
    }
};

module.exports = { sendSMS }; 