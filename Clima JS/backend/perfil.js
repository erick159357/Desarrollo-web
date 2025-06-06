const express = require('express');
const jwt = require('jsonwebtoken');
const sql = require('mssql');
const config = require('../database/config');
const validarToken = require('../middleware/validarToken');
const router = express.Router();

router.get('/', validarToken, async (req, res) => {
  try {
    const idUsuario = req.user.idUsuario; // Ya está decodificado del token

    // Conexión a la base de datos
    const pool = await sql.connect(config);

    // Consulta para obtener los datos del usuario
    const result = await pool
      .request()
      .input('idUsuario', sql.Int, idUsuario)
      .query('SELECT nombre, email FROM usuarios WHERE id = @idUsuario');

    const usuario = result.recordset[0];

    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    // Envía los datos del usuario como JSON
    res.status(200).json({ usuario });

  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

module.exports = router;
