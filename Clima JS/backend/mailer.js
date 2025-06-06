const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
// Verificación al arrancar
transporter.verify((err, success) => {
  if (err) {
    console.error("⚠️ Error de autenticacion del correo:", err);
  } else {
    console.log("✅ listo para enviar correos");
  }
});
async function sendContactFormToAdmin({ name, email, category, message }) {
  await transporter.sendMail({
    from: `"Web Clima" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: `${category} de un usuario`,
    html: `
      <h3>Tienes un nuevo mensaje de categoria ${category}</h3>
      <ul>
        <li><strong>Nombre:</strong> ${name}</li>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Categoría:</strong> ${category}</li>
      </ul>
      <p><strong>Mensaje:</strong></p>
      <p>${message.replace(/\n/g, "<br>")}</p>
    `,
  });
}

async function sendAutoReplyToUser({ name, email }) {
  await transporter.sendMail({
    from: `"Web Clima" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Hemos recibido tu mensaje",
    html: `
      <p>Hola ${name},</p>
      <p>Gracias por contactarnos. Hemos recibido tu mensaje y pronto te responderemos.</p>
      <p>— El equipo de Clima Proyecto</p>
    `,
  });
}
async function sendVerificationEmail(email, token) {
  const url = `http://localhost:${process.env.PORT}/verificar/${token}`;
  await transporter.sendMail({
    from: `"Clima JS App" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verifica tu cuenta - Clima JS App",
    html: `
      <h2>Verificación de cuenta</h2>
      <p>Gracias por registrarte. Haz clic en el siguiente enlace para verificar tu cuenta:</p>
      <a href="${url}">${url}</a>
    `,
  });
  console.log(`✉️ Correo de verificación enviado a ${email}`);
}

async function sendPasswordChangeEmail(email, changeDate) {
  await transporter.sendMail({
    from: `"Clima JS App" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Tu contraseña ha sido cambiada",
    html: `
      <h2>Notificacion de cambio de contraseña</h2>
      <p>Tu contraseña fue cambiada exitosamente el <strong>${changeDate}</strong>.</p>
      <p>Si no fuiste tu, por favor contactanos de inmediato.</p>
    `,
  });
  console.log(`✉️ Aviso de cambio de contraseña enviado a ${email}`);
}

module.exports = {
  sendVerificationEmail,
  sendPasswordChangeEmail,
  sendContactFormToAdmin,
  sendAutoReplyToUser,
};
