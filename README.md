# 💈 Big Brother Barber Shop - WhatsApp Chatbot

Chatbot de WhatsApp para **Big Brother Barber Shop** usando la **Meta WhatsApp Business Cloud API** (oficial) y **AWS Free Tier**.

## 🤖 ¿Qué hace el bot?

Cuando un cliente escribe al WhatsApp de la barbería, el bot responde automáticamente con:

| Opción | Función |
|--------|---------|
| 1️⃣ | Horarios de atención |
| 2️⃣ | Servicios y precios |
| 3️⃣ | Ubicación con link a Google Maps |
| 4️⃣ | Agendar una cita (flujo conversacional) |
| 5️⃣ | Hablar con alguien del equipo |

También detecta palabras clave como "hola", "precios", "ubicación", "cita", etc.

## 💰 Costo: $0/mes

| Servicio | Free Tier | Uso Estimado |
|----------|-----------|-------------|
| AWS Lambda | 1M requests/mes | ~1,000/mes |
| API Gateway | 1M calls/mes (12 meses) | ~1,000/mes |
| DynamoDB | 25GB permanente | ~100 citas/mes |
| WhatsApp API | 1,000 conv. servicio/mes | ~200-500/mes |

> Las conversaciones de **servicio** (cuando el cliente te escribe primero) son **GRATIS**. Solo pagas si TÚ inicias conversaciones de marketing.

## 🏗️ Arquitectura

```
Cliente WhatsApp → Meta Cloud API → API Gateway → Lambda → Responde via WhatsApp API
                                                      ↓
                                                  DynamoDB (citas)
```

## 📁 Estructura del Proyecto

```
bigbrother-barber-bot/
├── README.md
├── package.json
├── .env.example
├── .gitignore
├── template.yaml              # SAM/CloudFormation (infraestructura)
├── src/
│   ├── handlers/
│   │   └── webhook.js         # Lambda: recibe webhooks de Meta
│   ├── services/
│   │   ├── whatsapp.js        # Envía mensajes via WhatsApp Cloud API
│   │   ├── chatbot.js         # Lógica del chatbot (intenciones, respuestas)
│   │   └── appointments.js    # Gestión de citas en DynamoDB
│   ├── config/
│   │   └── barbershop.json    # Datos de la barbería (editable)
│   └── utils/
│       └── helpers.js         # Funciones auxiliares
├── events/
│   ├── sampleMessage.json     # Evento de prueba (mensaje)
│   └── sampleVerify.json      # Evento de prueba (verificación)
└── tests/
    └── chatbot.test.js        # Tests de detección de intenciones
```

---

## 🚀 Guía de Setup Paso a Paso

### Paso 1: Instalar Herramientas Necesarias

#### 1.1 Node.js
Descarga e instala Node.js 20+ desde: https://nodejs.org/

Verifica la instalación:
```bash
node --version   # Debe ser v20+
npm --version
```

#### 1.2 AWS CLI
Descarga e instala desde: https://aws.amazon.com/cli/

```bash
aws --version
```

#### 1.3 AWS SAM CLI
Descarga e instala desde: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

```bash
sam --version
```

#### 1.4 Git
Ya lo tienes instalado. Verifica con:
```bash
git --version
```

---

### Paso 2: Crear Cuenta AWS Free Tier

1. Ve a https://aws.amazon.com/free
2. Click en **"Crear una cuenta gratuita"**
3. Necesitarás:
   - Email
   - Tarjeta de crédito/débito (NO te cobran, es solo verificación)
   - Número de teléfono
4. Selecciona el plan **"Basic Support - Free"**
5. Una vez creada, configura AWS CLI:

```bash
aws configure
```

Te pedirá:
- **AWS Access Key ID**: Lo obtienes en AWS Console → IAM → Users → Security Credentials
- **AWS Secret Access Key**: Se muestra una sola vez al crear la key
- **Default region**: `us-east-1` (o la que prefieras)
- **Default output format**: `json`

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
5. En el dashboard de la app, busca **"WhatsApp"** y click en **"Configurar"**

#### 3.3 Obtener Credenciales
En la sección de WhatsApp de tu app:

1. **Phone Number ID**: Lo ves en WhatsApp → API Setup → Phone Number ID
2. **Temporary Token**: Click en "Generate" (dura 24h, luego necesitas uno permanente)
3. **Verify Token**: Este lo inventas tú (ejemplo: `mi_token_secreto_123`)

#### 3.4 Obtener Token Permanente
1. Ve a https://developers.facebook.com → Tu App → Settings → Basic
2. Copia el **App ID** y **App Secret**
3. Ve a Business Settings → System Users → Add
4. Crea un System User con rol **Admin**
5. Asigna la app al System User
6. Genera un token con permisos: `whatsapp_business_management`, `whatsapp_business_messaging`

> ⚠️ Para desarrollo/pruebas, el token temporal funciona bien. El permanente es para producción.

#### 3.5 Agregar Número de Teléfono
- Meta te da un **número de prueba gratuito** para desarrollo
- Para producción, necesitas agregar tu propio número de WhatsApp Business
- El número NO puede estar registrado en WhatsApp personal

---

### Paso 4: Clonar y Configurar el Proyecto

```bash
# Clonar el repositorio
git clone https://github.com/TU_USUARIO/bigbrother-barber-bot.git
cd bigbrother-barber-bot

# Instalar dependencias
npm install

# Copiar archivo de configuración
cp .env.example .env
```

Edita el archivo `.env` con tus credenciales:
```env
WHATSAPP_TOKEN=tu_token_de_whatsapp
WHATSAPP_PHONE_NUMBER_ID=tu_phone_number_id
VERIFY_TOKEN=tu_token_de_verificacion_personalizado
OWNER_PHONE=573001234567
```

#### 4.1 Personalizar Datos de la Barbería
Edita `src/config/barbershop.json` con los datos reales:
- Nombre, dirección, horarios
- Servicios y precios
- Link de Google Maps
- Coordenadas de ubicación

---

### Paso 5: Ejecutar Tests

```bash
npm test
```

Deberías ver todos los tests pasando ✅

---

### Paso 6: Desplegar en AWS

```bash
# Construir el proyecto
sam build

# Desplegar (primera vez, modo guiado)
sam deploy --guided
```

Durante el deploy guiado te preguntará:
- **Stack Name**: `bigbrother-barber-bot`
- **AWS Region**: `us-east-1`
- **WhatsAppToken**: Tu token de WhatsApp
- **WhatsAppPhoneNumberId**: Tu Phone Number ID
- **VerifyToken**: Tu token de verificación personalizado
- **OwnerPhone**: Tu número de teléfono (ej: 573001234567)
- **Confirm changes before deploy**: `y`
- **Allow SAM CLI IAM role creation**: `y`
- **Save arguments to configuration file**: `y`

Al finalizar, verás la **Webhook URL** en los outputs:
```
https://xxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/webhook
```

---

### Paso 7: Configurar Webhook en Meta

1. Ve a https://developers.facebook.com → Tu App → WhatsApp → Configuration
2. En **Webhook**:
   - **Callback URL**: Pega la URL del paso anterior
   - **Verify Token**: El mismo que pusiste en `.env`
3. Click en **"Verify and Save"**
4. En **Webhook Fields**, suscríbete a: `messages`

---

### Paso 8: ¡Probar el Bot! 🎉

1. Desde tu teléfono, envía un mensaje al número de WhatsApp Business
2. Escribe **"Hola"**
3. El bot debería responder con el menú de opciones

---

## 🔧 Comandos Útiles

```bash
# Ver logs en tiempo real
sam logs -n BigBrother-WhatsApp-Webhook --stack-name bigbrother-barber-bot --tail

# Invocar Lambda localmente (requiere Docker)
sam local invoke WebhookFunction -e events/sampleMessage.json

# Actualizar después de cambios
sam build && sam deploy

# Eliminar todo el stack
sam delete --stack-name bigbrother-barber-bot
```

---

## 📝 Personalización

### Cambiar datos de la barbería
Edita [`src/config/barbershop.json`](src/config/barbershop.json):
- Nombre, slogan
- Horarios por día
- Servicios con precios y emojis
- Dirección y coordenadas GPS
- Link de Google Maps

### Agregar nuevas intenciones
Edita [`src/services/chatbot.js`](src/services/chatbot.js):
1. Agrega keywords en el objeto `intents` dentro de `detectIntent()`
2. Crea una nueva función de respuesta
3. Agrega el case en el switch de `processMessage()`

---

## ❓ Preguntas Frecuentes

**¿Es realmente gratis?**
Sí, para una barbería pequeña (~200-500 conversaciones/mes). Las conversaciones de servicio (cliente te escribe primero) son gratis hasta 1,000/mes. AWS Free Tier cubre Lambda, API Gateway y DynamoDB.

**¿Qué pasa después de 12 meses de AWS?**
Lambda y DynamoDB siguen siendo gratis. API Gateway costaría ~$0.003/mes para el volumen de una barbería. Prácticamente nada.

**¿Puedo usar mi número personal de WhatsApp?**
No. Necesitas un número dedicado para WhatsApp Business. No puede estar registrado en WhatsApp personal.

**¿El bot responde 24/7?**
Sí. Lambda se ejecuta automáticamente cuando llega un mensaje.

**¿Puedo agregar IA/ChatGPT?**
Sí, pero eso tendría costo adicional (OpenAI API). La versión actual usa detección de keywords que es gratis y suficiente para una barbería.

---

## 📄 Licencia

MIT
