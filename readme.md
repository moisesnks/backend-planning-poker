# Planning Poker + MongoDB + SocketIo

Esta es una aplicación de servidor Node.js que utiliza Express, Socket.IO y MongoDB. Está diseñada para gestionar salas de chat donde los usuarios pueden unirse, enviar mensajes y votar sobre temas. A continuación, se presenta una descripción general del código:

## Descripción General

- El servidor está configurado utilizando Express y Socket.IO y escucha en un puerto especificado.
- El servidor se conecta a una base de datos MongoDB utilizando una función `connectDB`.
- Cuando un cliente se conecta al servidor, se configuran varios escuchadores de eventos para manejar diferentes tipos de mensajes del cliente.

## Eventos y Funcionalidades

### Evento `createRoom`

Crea una nueva sala de chat si no existe.

### Evento `joinRoom`

Permite a un usuario unirse a una sala existente.

### Evento `disconnect`

Maneja la desconexión de un usuario del servidor, actualizando su estado en todas las salas en las que forma parte.

### Evento `newMessage`

Maneja el envío de un nuevo mensaje por parte de un usuario en una sala.

### Evento `vote`

Permite a un usuario votar sobre un tema en una sala. Los votos se encriptan utilizando AES de la biblioteca CryptoJS.

### Evento `revealVotes`

Revela todos los votos en una sala, los desencripta, calcula los resultados y transmite estos resultados a todos los usuarios en la sala.

### Evento `changeTopic`

Permite cambiar el tema de discusión en una sala.

### Evento `resetRoom`

Reinicia una sala, limpiando todos los votos y mensajes.

### Evento `getVote`

Recupera el voto de un usuario.

## Función `calculateResults`

Calcula el voto promedio, mínimo y máximo, y la proporción de votos que coincidieron con el promedio.

## Archivo `vercel.json`

Para desplegar tu backend en Vercel, usa la siguiente configuración en `vercel.json`:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "index.js"
    }
  ]
}
```

## Despliegue

1. **Configura tu entorno**: Asegúrate de que tu base de datos MongoDB esté configurada y accesible.
2. **Sube tu proyecto a Vercel**: Sube tu proyecto a Vercel y configura las variables de entorno necesarias en el Dashboard de Vercel.
3. **Despliega**: Sigue los pasos de despliegue en Vercel para poner en funcionamiento tu servidor.

## Variables de Entorno

Asegúrate de crear un archivo `.env` en la raíz de tu proyecto con las siguientes variables de entorno:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
PORT=4000
SECRETKEY=secretKey
```

## Autor
El autor de este código es [moisesnks](https://github.com/moisesnks), fecha 25-05-2024.

