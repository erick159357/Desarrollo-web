require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sql, pool, poolConnect } = require("./db");
const {
  sendVerificationEmail,
  sendPasswordChangeEmail,   
} = require("./mailer");

const app = express();
app.use(cors());
app.use(express.json());
app.use(cors({ origin: "http://127.0.0.1:5500" })); 
app.use(express.json());                            


app.get("/", (req, res) => {
  res.send("¡Servidor Clima JS en línea!");
});

// — Registro
app.post("/registro", async (req, res) => {
  const { nombre, email, password } = req.body;
  if (!nombre || !email || !password)
    return res.status(400).json({ mensaje: "Todos los campos son obligatorios." });
  if (password.length < 6)
    return res
      .status(400)
      .json({ mensaje: "La contraseña debe tener al menos 6 caracteres." });

  const token = Math.random().toString(36).substring(2, 66);
  const hashed = await bcrypt.hash(password, 10);

  try {
    await poolConnect;
    // Verificar correo único
    const { recordset } = await pool
      .request()
      .input("email", sql.VarChar, email)
      .query("SELECT COUNT(*) AS total FROM usuarios WHERE email=@email");
      if (recordset[0].total > 0)
        return res.status(400).json({ mensaje: "Correo ya registrado." });

    // Insert
    await pool
      .request()
      .input("nombre", sql.VarChar, nombre)
      .input("email", sql.VarChar, email)
      .input("password", sql.VarChar, hashed)
      .input("token", sql.VarChar, token)
      .query(
        `INSERT INTO usuarios (nombre,email,contraseña,token)
         VALUES (@nombre,@email,@password,@token)`
      );

    // Envío de correo
    await sendVerificationEmail(email, token);
    res.status(201).json({
      mensaje:
        "Registro exitoso. Revisa tu correo para verificar tu cuenta.",
    });
  } catch (err) {
    console.error("Error en /registro:", err);
    res.status(500).json({ mensaje: "Error al registrar usuario." });
  }
});

// — Verificación de cuenta
app.get("/verificar/:token", async (req, res) => {
  const { token } = req.params;
  try {
    await poolConnect;
    const { rowsAffected } = await pool
      .request()
      .input("token", sql.VarChar, token)
      .query(
        "UPDATE usuarios SET confirmado=1 WHERE token=@token AND confirmado=0"
      );

    if (rowsAffected[0] > 0) {
      res.send("✅ Cuenta verificada con éxito. Ya puedes iniciar sesión.");
    } else {
      res.send("❌ Token inválido o cuenta ya verificada.");
    }
  } catch (err) {
    console.error("Error en /verificar:", err);
    res.status(500).send("Error al verificar el token.");
  }
});

// — Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ mensaje: "Ingrese email y contraseña." });

  try {
    await poolConnect;
    const { recordset } = await pool
      .request()
      .input("email", sql.VarChar, email)
      .query(
        "SELECT id,nombre,contraseña,confirmado FROM usuarios WHERE email=@email"
      );
    const user = recordset[0];
    if (!user || !user.confirmado)
      return res
        .status(400)
        .json({ mensaje: "Usuario no existe o no ha confirmado aún." });

    const match = await bcrypt.compare(password, user.contraseña);
    if (!match)
      return res.status(400).json({ mensaje: "Contraseña incorrecta." });

    const token = jwt.sign(
      { id: user.id, nombre: user.nombre },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );
    res.json({ mensaje: "Login exitoso.", token });
  } catch (err) {
    console.error("Error en /login:", err);
    res.status(500).json({ mensaje: "Error al iniciar sesión." });
  }
});

// Middleware de autenticación
function authenticateToken(req, res, next) {
  const auth = req.headers["authorization"];
  const token = auth && auth.split(" ")[1];
  if (!token) return res.status(401).json({ mensaje: "Token requerido." });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ mensaje: "Token inválido." });
    req.user = user;
    next();
  });
}

// — Perfil (protegido)
app.get("/perfil", authenticateToken, async (req, res) => {
  res.json({ nombre: req.user.nombre, id: req.user.id });
});

// — Contacto
app.post("/contacto", async (req, res) => {
  console.log("▶️ /contacto recibida:", req.body);
  const { name, email, category, message } = req.body;
  // validaciones…
  try {
    await sendContactFormToAdmin({ name, email, category, message });
    console.log("✉️ Enviado al admin");
    await sendAutoReplyToUser({ name, email });
    console.log("✉️ Acuse enviado al usuario");
    return res.json({ mensaje: "Mensaje enviado correctamente." });
  } catch (err) {
    console.error("❌ Error en /contacto:", err);
    return res.status(500).json({ mensaje: "Error al enviar tu mensaje." });
  }
});

// — Levantar servidor
app.listen(process.env.PORT, () =>
  console.log(`Servidor en el puerto ${process.env.PORT}`)
);

// ****************Ruta para cambiar contraseña*******************
app.post("/cambiar-contrasena", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  try {
    await poolConnect;

    //Obtener la contraseña actual de la BD
    const result = await pool
      .request()
      .input("id", sql.Int, userId)
      .query("SELECT contraseña, email FROM usuarios WHERE id = @id");

    if (result.recordset.length === 0) {
      return res.status(404).json({ mensaje: "Usuario no encontrado." });
    }

    const { contraseña: hashEnDB, email } = result.recordset[0];

    //Verificar contraseña actual
    const match = await bcrypt.compare(currentPassword, hashEnDB);
    if (!match) {
      return res.status(401).json({ mensaje: "Contraseña actual incorrecta." });
    }

    //Hashear la nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    //Actualizar en la BD
    await pool
      .request()
      .input("id", sql.Int, userId)
      .input("password", sql.VarChar, newHash)
      .query("UPDATE usuarios SET contraseña = @password WHERE id = @id");

    //Enviar correo de notificación
    const fechaCambio = new Date().toLocaleString();
    await sendPasswordChangeEmail(email, fechaCambio);

    res.json({ mensaje: "Contraseña cambiada con éxito." });
  } catch (err) {
    console.error("Error en /cambiar-contrasena:", err);
    res.status(500).json({ mensaje: "Error al cambiar contraseña." });
  }

});
//Recibir correo
const { sendContactFormToAdmin, sendAutoReplyToUser } = require("./mailer");
app.post("/contacto", async (req, res) => {
  const { name, email, category, message } = req.body;
  if (!name || !email || !category || !message) {
    return res.status(400).json({ mensaje: "Todos los campos son obligatorios." });
  }

  try {
    // 1. Enviar al administrador
    await sendContactFormToAdmin({ name, email, category, message });

    // 2. Envío de acuse de recibo al usuario
    await sendAutoReplyToUser({ name, email });

    return res.json({ mensaje: "Mensaje enviado correctamente. ¡Gracias por contactarnos!" });
  } catch (err) {
    console.error("Error en /contacto:", err);
    return res.status(500).json({ mensaje: "Error al enviar tu mensaje." });
  }
});







