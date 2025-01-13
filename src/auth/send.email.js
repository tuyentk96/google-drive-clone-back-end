const nodemailer = require('nodemailer')
const { emailConfig: { username, password } } = require('../configs/config.system')


const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // true for port 465, false for other ports
    auth: {
        user: username,
        pass: password,
    },
});

const sendEmailFromRegister = async (email) => {
    const accessNumber = Math.floor(Math.random() * 10000)

    await transporter.sendMail({
        from: username,
        to: email,
        subject: "Register Clone GGDrive",
        text: `Your access number is: ${accessNumber}`
    })

    return accessNumber;
}

const sendEmailFromForgotUser = async (email) => {
    const accessNumber = Math.floor(Math.random() * 10000)

    await transporter.sendMail({
        from: username,
        to: email,
        subject: "Forgot User Clone GGDrive",
        text: `Your access number is: ${accessNumber}`
    })

    return accessNumber;
}

module.exports = {
    sendEmailFromRegister, sendEmailFromForgotUser
}