async function sendOTP() {
    const phoneNumber = document.getElementById('phoneNumber').value;
    const messageDiv = document.getElementById('message');
    const verifySection = document.querySelector('.verify-section');

    if (!phoneNumber || phoneNumber.length < 10) {
        messageDiv.textContent = 'Please enter a valid phone number';
        messageDiv.className = 'error';
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/send-otp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                phoneNumber: phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`
            })
        });

        const data = await response.json();

        if (data.success) {
            messageDiv.textContent = 'OTP sent successfully!';
            messageDiv.className = 'success';
            verifySection.style.display = 'block';
        } else {
            throw new Error(data.error || 'Failed to send OTP');
        }
    } catch (error) {
        messageDiv.textContent = error.message;
        messageDiv.className = 'error';
    }
}

async function verifyOTP() {
    const phoneNumber = document.getElementById('phoneNumber').value;
    const otpCode = document.getElementById('otpCode').value;
    const messageDiv = document.getElementById('message');

    try {
        const response = await fetch('http://localhost:3000/verify-otp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                phoneNumber: phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`,
                code: otpCode
            })
        });

        const data = await response.json();

        if (data.success && data.status === 'approved') {
            messageDiv.textContent = 'OTP verified successfully!';
            messageDiv.className = 'success';
        } else {
            throw new Error('Invalid OTP');
        }
    } catch (error) {
        messageDiv.textContent = error.message;
        messageDiv.className = 'error';
    }
}

document.getElementById('sendOTP').addEventListener('click', sendOTP);
document.getElementById('verifyOTP').addEventListener('click', verifyOTP); 