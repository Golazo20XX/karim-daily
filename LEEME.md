# Karim Daily · Cada día, con Karim

App sencilla para registrar las comidas y los paseos de Karim.

- **Dónde se guardan los datos:** en una hoja de Google Sheets de **tu Google Drive** (pestañas "Registros" y "Perfil"). Puedes abrirla y ver o corregir todo cuando quieras.
- **Dónde vive la app:** en GitHub Pages. Es gratis y no usa Netlify.
- **Qué queda en cada teléfono:** solo el enlace de Google, la clave de la casa y el nombre de quien usa ese teléfono. Ningún registro.

Necesitas hacer esto una sola vez. Toma unos 15 minutos.

---

## Paso 1 · Crear la hoja en tu Google Drive

1. Entra a <https://drive.google.com> con tu cuenta personal.
2. **Nuevo › Hojas de cálculo de Google › Hoja de cálculo en blanco**. Ponle de nombre **Karim Daily**.
3. En la hoja, abre el menú **Extensiones › Apps Script**.
4. Borra todo lo que aparece y pega el contenido completo del archivo `google-apps-script/Codigo.gs`.
5. En la línea `const CLAVE = 'CAMBIA-ESTA-CLAVE';` cambia `CAMBIA-ESTA-CLAVE` por una palabra secreta de tu casa (por ejemplo `karim-orejas-2016`). Sin espacios.
6. Pulsa el ícono de guardar (💾).
7. Arriba, en la lista de funciones, elige **configurar** y pulsa **Ejecutar**.
   Google te pedirá permisos: **Revisar permisos › tu cuenta › Configuración avanzada › Ir a Karim Daily › Permitir**.
   (Sale ese aviso porque el script es tuyo y no está verificado por Google; es normal.)
8. Vuelve a la hoja: verás las pestañas **Registros** y **Perfil** (ya con los datos de Karim). En tu Drive también aparece la carpeta **"Karim Daily - fotos"**, donde se guardarán las fotos que suban desde la app.

## Paso 2 · Publicar el script como "aplicación web"

1. En Apps Script, pulsa **Implementar › Nueva implementación**.
2. En el engranaje de "Seleccionar tipo", elige **Aplicación web**.
3. Configura:
   - **Ejecutar como:** Yo
   - **Quién tiene acceso:** Cualquier usuario
4. Pulsa **Implementar** y copia la **URL de la aplicación web**. Termina en `/exec`.

> "Cualquier usuario" significa que cualquiera con esa URL **y** la clave puede escribir. Sin la clave, el script no responde nada. No publiques la URL junto con la clave.

> Si algún día cambias el código: **Implementar › Gestionar implementaciones › ✏️ › Versión: Nueva versión › Implementar**. Así la URL no cambia.

## Paso 3 · Subir la app a GitHub Pages

1. Entra a <https://github.com> e inicia sesión (o crea una cuenta gratis).
2. Arriba a la derecha, **+ › New repository**.
   - Nombre: `karim-daily`
   - Visibilidad: **Public** (GitHub Pages gratis lo pide; solo se ve el diseño y las fotos, **no** los registros, que están en tu Drive).
   - Pulsa **Create repository**.
3. En la página del repositorio, pulsa **uploading an existing file**.
4. Arrastra **todo el contenido** de la carpeta `karim-daily` (los archivos `index.html`, `estilos.css`, `app.js`, `manifest.webmanifest` y las carpetas `img` y `google-apps-script`). Pulsa **Commit changes**.
5. Ve a **Settings › Pages**. En "Branch" elige **main** y carpeta **/ (root)**. Pulsa **Save**.
6. Espera 1 o 2 minutos. Tu app quedará en:
   `https://TU-USUARIO.github.io/karim-daily/`

Para cambios futuros: entra al repositorio, abre el archivo, pulsa el lápiz ✏️, edita y **Commit changes**. La app se actualiza sola en un par de minutos.

## Paso 4 · Conectar cada teléfono

1. Abre `https://TU-USUARIO.github.io/karim-daily/` en el teléfono.
2. Se abre **Configuración**. Escribe tu nombre, pega la URL `/exec` del paso 2 y la clave de la casa.
3. Pulsa **Guardar y conectar**.
4. Para tenerla como app: en iPhone (Safari) **Compartir › Agregar a pantalla de inicio**; en Android (Chrome) **⋮ › Agregar a pantalla principal**. Aparece con el ícono de Karim Daily.

**Atajo para la familia:** puedes mandarles por WhatsApp este enlace. Configura el teléfono de una vez y después se borra solo de la barra de direcciones:

```
https://TU-USUARIO.github.io/karim-daily/?api=URL-EXEC&clave=TU-CLAVE
```

Cada persona solo tendrá que escribir su nombre en el engranaje ⚙️.

## Probar sin conectar nada

Abre `https://TU-USUARIO.github.io/karim-daily/?demo` para ver la app con registros de ejemplo. En ese modo no se guarda nada.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Estructura de la app |
| `estilos.css` | Diseño (colores, Nunito + Inter) |
| `app.js` | Funcionamiento y conexión con Google Drive |
| `manifest.webmanifest` | Permite instalarla en el teléfono |
| `img/` | Ícono, logo y fotos de Karim |
| `google-apps-script/Codigo.gs` | Código que va dentro de la hoja de Google |

## Cambiar la foto o los datos de Karim

En la pestaña **Karim**, toca el lápiz azul junto a su foto. Ahí puedes:

- **Cambiar la foto de perfil** y la **foto de inicio** (la grande de la portada). Elige una foto del teléfono y se sube sola. La app la achica antes de enviarla para que suba rápido.
- Cambiar nombre, raza, fecha de nacimiento, peso, porciones al día y notas. Luego pulsa **Guardar**.

Las fotos quedan en la carpeta **"Karim Daily - fotos"** de tu Google Drive. Cuando cambias una foto, la anterior va a la papelera de Drive, así que puedes recuperarla durante 30 días. Todos los teléfonos de la casa ven la foto nueva.

Mientras nadie suba una foto, la app usa las que vienen en la carpeta `img/` (`karim-inicio.jpg` y `karim-perfil.jpg`).
