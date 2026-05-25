# 💈 Big Brother Barber Shop - WhatsApp Chatbot

Chatbot de WhatsApp para **Big Brother Barber Shop** usando **Meta WhatsApp Business Cloud API** + **Vercel** (serverless) + **MongoDB Atlas** (base de datos).

**Todo 100% gratis para siempre.** ✅

---

## 🤖 ¿Qué hace el bot?

Cuando un cliente escribe al WhatsApp de la barbería, el bot responde automáticamente:

| Opción | Función |
|--------|---------|
| 1️⃣ | Horarios de atención |
| 2️⃣ | Servicios y precios |
| 3️⃣ | Ubicación con link a Google Maps |
| 4️⃣ | Agendar una cita (flujo conversacional) |
| 5️⃣ | Hablar con alguien del equipo |

También detecta palabras clave como "hola", "precios", "ubicación", "cita", etc.

---

## 💰 Costo: $0/mes — GRATIS PARA SIEMPRE

| Servicio | Free Tier | Límite | ¿Expira? |
|----------|-----------|--------|----------|
| **Vercel** | Serverless Functions | 100GB bandwidth/mes | ❌ Gratis siempre |
| **MongoDB Atlas** | M0 Cluster | 512MB storage | ❌ Gratis siempre |
| **WhatsApp Cloud API** | Conversaciones de servicio | 1,000/mes | ❌ Gratis siempre |
| **GitHub** | Repositorio | Ilimitado | ❌ Gratis siempre |

> 💡 Las conversaciones de **servicio** (cuando el cliente te escribe primero y tú respondes) son **GRATIS**. Solo pagarías si TÚ inicias conversaciones de marketing, lo cual este bot NO hace.

---

## 🏗️ Arquitectura

```
Cliente WhatsApp → Meta Cloud API → Vercel (serverless function) → Responde via WhatsApp API
                                              ↓
                                     MongoDB Atlas (citas)
```

- **Sin servidores** que mantener
- **Deploy automático** con `git push`
- **Escala automáticamente**

---

## 📁 Estructura del Proyecto

```
bigbrother-barber-bot/
├── README.md
├── package.json
├── vercel.json                    # Configuración de Vercel
├── .env.example
├── .gitignore
├── api/
│   └── webhook.js                 # Serverless function (endpoint del webhook)
├── src/
│   ├── services/
│   │   ├── whatsapp.js            # Envía respuestas via WhatsApp Cloud API
│   │   ├── chatbot.js             # Lógica del chatbot (intenciones, respuestas)
│   │   └── appointments.js        # Gestión de citas en MongoDB Atlas
│   ├── config/
│   │   └── barbershop.json        # Datos de la barbería (editable)
│   └── utils/
│       └── helpers.js             # Funciones auxiliares
├── events/
│   ├── sampleMessage.json         # Evento de prueba (mensaje)
│   └── sampleVerify.json          # Evento de prueba (verificación)
└── tests/
    └── chatbot.test.js            # Tests de detección de intenciones
```

---

## 🚀 Guía de Setup Paso a Paso

### Paso 1: Requisitos Previos

Necesitas tener instalado:
- **Node.js 20+**: https://nodejs.org
- **Git**: https://git-scm.com

Verifica:
```bash
node --version   # v20+
npm --version
git --version
```

---

### Paso 2: Crear Cuenta en MongoDB Atlas (Base de Datos Gratis)

1. Ve a https://www.mongodb.com/cloud/atlas/register
2. Crea una cuenta (puedes usar Google)
3. Selecciona **M0 FREE** (el plan gratuito)
4. Elige la región más cercana (ej: `us-east-1` o `sa-east-1` para Sudamérica)
5. Click en **"Create Deployment"**

#### 2.1 Crear Usuario de Base de Datos
1. En el panel de Atlas, ve a **Database Access** → **Add New Database User**
2. Método: **Password**
3. Username: `barberbot`
4. Password: genera una segura y **guárdala**
5. Role: **Read and write to any database**
6. Click **"Add User"**

#### 2.2 Configurar Acceso de Red
1. Ve a **Network Access** → **Add IP Address**
2. Click en **"Allow Access from Anywhere"** (0.0.0.0/0)
   - Esto es necesario para que Vercel pueda conectarse
3. Click **"Confirm"**

#### 2.3 Obtener Connection String
1. Ve a **Database** → **Connect** → **Drivers**
2. Copia el connection string. Se ve así:
   ```
   mongodb+srv://barberbot:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
3. Reemplaza `<password>` con la contraseña que creaste
4. **Guarda este string**, lo necesitarás después

---

### Paso 3: Configurar Meta WhatsApp Business API

#### 3.1 Crear Meta Business Account
1. Ve a https://business.facebook.com
2. Crea una cuenta de negocio (o usa una existente)

#### 3.2 Crear App en Meta Developers
1. Ve a https://developers.facebook.com
2. Click en **"Crear app"**
3. Selecciona **"Otro"** → **"Empresa"**
4. Nombre: `Big Brother Barber Bot`
5. En el dashboard, busca **"WhatsApp"** y click en **"Configurar"**

#### 3.3 Obtener Credenciales
En la sección de WhatsApp de tu app:

1. **Phone Number ID**: WhatsApp → API Setup → Phone Number ID
2. **Temporary Token**: Click en "Generate" (dura 24h)
3. **Verify Token**: Invéntalo tú (ejemplo: `mi_token_secreto_barberia_123`)

> 💡 Para desarrollo, el token temporal funciona. Para producción, necesitas un token permanente (ver sección de FAQ).

---

### Paso 4: Crear Cuenta en Vercel (Hosting Gratis)

1. Ve a https://vercel.com/signup
2. Regístrate con tu cuenta de **GitHub** (la más fácil)
3. Autoriza el acceso a tus repositorios

---

### Paso 5: Clonar y Configurar el Proyecto

```bash
# Clonar el repositorio
git clone https://github.com/AndresFelipeGA/bigbrother-barber-bot.git
cd bigbrother-barber-bot

# Instalar dependencias
npm install
```

---

### Paso 6: Desplegar en Vercel

#### Opción A: Desde la Web (más fácil)
1. Ve a https://vercel.com/new
2. Importa el repositorio `bigbrother-barber-bot`
3. En **Environment Variables**, agrega:
   - `WHATSAPP_TOKEN` = tu token de WhatsApp
   - `WHATSAPP_PHONE_NUMBER_ID` = tu Phone Number ID
   - `VERIFY_TOKEN` = tu token de verificación personalizado
   - `MONGODB_URI` = tu connection string de MongoDB Atlas
   - `OWNER_PHONE` = tu número de teléfono (ej: 573001234567)
4. Click en **"Deploy"**

#### Opción B: Desde la Terminal
```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

Al finalizar, obtendrás una URL como:
```
https://bigbrother-barber-bot.vercel.app
```

Tu webhook URL será:
```
https://bigbrother-barber-bot.vercel.app/webhook
```

---

### Paso 7: Configurar Webhook en Meta

1. Ve a https://developers.facebook.com → Tu App → WhatsApp → Configuration
2. En **Webhook**:
   - **Callback URL**: `https://bigbrother-barber-bot.vercel.app/webhook`
   - **Verify Token**: El mismo que pusiste en las variables de entorno
3. Click en **"Verify and Save"**
4. En **Webhook Fields**, suscríbete a: **`messages`**

---

### Paso 8: ¡Probar el Bot! 🎉

1. Desde tu teléfono, envía un mensaje al número de WhatsApp Business
2. Escribe **"Hola"**
3. El bot debería responder con el menú de opciones

---

## 📝 Personalización

### Cambiar datos de la barbería
Edita `src/config/barbershop.json`:
- Nombre, slogan
- Horarios por día
- Servicios con precios y emojis
- Dirección y coordenadas GPS
- Link de Google Maps

Después de editar, haz commit y push:
```bash
git add -A && git commit -m "update barbershop info" && git push
```
Vercel desplegará automáticamente los cambios.

### Agregar nuevas intenciones al chatbot
Edita `src/services/chatbot.js`:
1. Agrega keywords en el objeto `intents` dentro de `detectIntent()`
2. Crea una nueva función de respuesta
3. Agrega el case en el switch de `processMessage()`

---

## 🔧 Comandos Útiles

```bash
# Correr tests
npm test

# Desarrollo local (requiere Vercel CLI)
vercel dev

# Deploy a producción
vercel --prod

# Ver logs
vercel logs https://bigbrother-barber-bot.vercel.app
```

---

## ❓ Preguntas Frecuentes

**¿Es realmente gratis para siempre?**
Sí. Vercel Free Tier, MongoDB Atlas M0, y WhatsApp conversaciones de servicio son gratis sin fecha de expiración.

**¿Puedo usar mi número personal de WhatsApp?**
No. Necesitas un número dedicado para WhatsApp Business que no esté registrado en WhatsApp personal.

**¿El bot responde 24/7?**
Sí. Vercel ejecuta la función automáticamente cuando llega un mensaje.

**¿Cómo obtengo un token permanente de WhatsApp?**
1. Ve a Meta Business Settings → System Users → Add
2. Crea un System User con rol Admin
3. Asigna la app al System User
4. Genera un token con permisos: `whatsapp_business_management`, `whatsapp_business_messaging`

**¿Puedo agregar IA/ChatGPT?**
Sí, pero eso tendría costo adicional (OpenAI API). La versión actual usa detección de keywords que es gratis y suficiente para una barbería.

**¿Qué pasa si supero los 512MB de MongoDB?**
Para una barbería, 512MB alcanza para miles de citas. Si algún día lo superas, puedes hacer upgrade por ~$9/mes.

**¿Cómo actualizo el bot?**
Edita los archivos, haz `git push`, y Vercel despliega automáticamente.

---

## 📄 Licencia

MIT
