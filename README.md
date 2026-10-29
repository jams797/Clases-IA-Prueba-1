# Banca de demostración Jose S.A.

Pantallas en HTML, CSS y JavaScript sin dependencias. Incluyen el logo SVG proporcionado y un diseño adaptable basado en las referencias de login, registro, OTP, creación de contraseña e inicio bancario.

## Ejecutar

Abre `index.html` en un navegador moderno. Si tu navegador restringe el almacenamiento al abrir archivos locales, utiliza un servidor desde esta carpeta:

```sh
python3 -m http.server 8080
```

Visita http://localhost:8080.

## Credenciales de demostración

- Usuario: `demo@jose.com`
- Contraseña: `Jose2026!`

El login valida campos obligatorios, formato de correo y credenciales. Incluye mostrar/ocultar contraseña, recordar únicamente el correo, errores accesibles e inicio bancario. La sesión de acceso vence después de 30 minutos. Recuperación y biometría muestran diálogos informativos.

## Pantalla de inicio

Después de ingresar se abre `bienvenida.html`, ahora con el inicio bancario. Muestra el nombre registrado y su inicial; la cuenta `demo@jose.com` usa el nombre ficticio Jose Morán. El saludo corresponde a la hora de Ecuador.

- Banner con tres novedades, desplazamiento e indicadores pulsables.
- Tres productos ficticios: cuenta de ahorros, tarjeta de crédito y ahorro programado. En móvil se deslizan; en escritorio se muestran juntos. Cada tarjeta abre su detalle; «Ver todos» muestra el listado.
- Botón superior para ocultar y mostrar los valores en productos, movimientos y cuenta de origen. La preferencia permanece al recargar.
- Notificaciones de demostración con opción para marcarlas como leídas.
- Accesos rápidos editables: selecciona de uno a cuatro entre transferencias, servicios, recargas, QR, productos y movimientos.
- Últimos movimientos e historial con filtros de ingresos, salidas, transferencias y pagos.
- Menú inferior con Inicio, Transferir, Pagos y Perfil. Desde el perfil puedes cerrar sesión.

Transferencias, pagos y recargas permiten introducir destino y monto, validar los datos, revisar la operación y confirmarla o cancelarla. Una confirmación descuenta el valor del saldo ficticio de ahorros y agrega un movimiento; una cancelación no modifica nada. Los cálculos usan centavos enteros. Pago QR permite probar el flujo con una referencia escrita: no escanea códigos ni utiliza la cámara.

Productos, movimientos, accesos y preferencias se conservan en `sessionStorage` por correo de cuenta. Se mantienen al recargar o volver a iniciar sesión en la misma pestaña. No hay comunicación con bancos, proveedores ni movimiento de dinero real. Si se bloquea el almacenamiento, se informa el fallo y una simulación fallida no modifica el saldo en memoria.

## Crear una cuenta de prueba

1. Pulsa «Regístrate» en el login, o abre `registro.html`.
2. Completa nombre y apellido, correo, celular ecuatoriano y dirección usando datos ficticios. Acepta los términos de la demo. Se aceptan 9 dígitos comenzando con 9, o 10 con el 0 inicial. Se eliminan espacios y el prefijo +593 al normalizar el teléfono.
3. Copia el OTP de prueba mostrado en la pantalla. No se envía SMS. Puedes pegar los seis dígitos juntos; el foco avanza automáticamente. El código dura 5 minutos, permite 5 intentos y se puede reenviar después de 30 segundos. Un reenvío invalida el código anterior.
4. Crea una contraseña con al menos 8 caracteres, una mayúscula, un número y un símbolo; confírmala. El botón se habilita cuando cumple todas las reglas y ambas entradas coinciden. Si vence la verificación antes de guardar, vuelve a OTP y solicita un nuevo código.
5. Al guardar, vuelves al login con el correo completado y puedes acceder con la contraseña creada.

Puedes retroceder y editar los datos sin perder el formulario. Cambiar los datos requiere verificar un nuevo código. No se permite reutilizar el correo de una cuenta de prueba existente.

Las cuentas de prueba se guardan en `sessionStorage`, únicamente en la pestaña actual. Permanecen al recargar y cerrar sesión, y se descartan al cerrar la pestaña. La contraseña no se guarda en texto: se conserva un verificador PBKDF2-SHA256 con sal aleatoria y 100 000 iteraciones. Al completar el registro se elimina el borrador con dirección y celular. El uso de Web Crypto requiere un navegador moderno y un contexto seguro; si falla al abrir archivos directamente, utiliza `http://localhost:8080`.

## Archivos

- `index.html`, `styles.css`, `app.js`: pantalla de acceso e interacciones.
- `auth.js`: validaciones y autenticación de demostración.
- `registro.html`, `registro.css`, `registro.js`: las tres vistas del proceso y sus interacciones.
- `registro-service.js`: validaciones, estados del registro, generación/verificación OTP y alta local.
- `bienvenida.html`, `bienvenida.js`, `dashboard.css`: inicio bancario, vistas del menú, acciones y cierre de sesión.
- `dashboard-data.js`: productos y movimientos ficticios, preferencias por cuenta y simulaciones locales. Punto de reemplazo para conectar los servicios bancarios reales.
- `assets/jose-sa-logo.svg`: logo original.
- `tests/auth.test.cjs`: pruebas de validación y sesión con Node.js.
- `tests/login.test.cjs`: pruebas de las interacciones usando un DOM mínimo.
- `tests/registration.test.cjs`: pruebas del flujo y casos de error del registro.
- `tests/dashboard.test.cjs`: cálculos, validaciones, operaciones locales, preferencias, aislamiento por cuenta y fallos de almacenamiento.
- `tests/browser-qa.cjs`: comprobación opcional del flujo completo en Chrome mediante CDP.

## Verificación

Usa Node.js 18 o superior para ejecutar todas las pruebas:

```sh
node tests/auth.test.cjs
node tests/login.test.cjs
node tests/registration.test.cjs
node tests/dashboard.test.cjs
```

La prueba opcional de navegador requiere Node.js 22+, el servidor local en el puerto 8080 y una instancia de Chrome de pruebas con `--remote-debugging-port=9223` y un perfil temporal separado. Ejecuta `node tests/browser-qa.cjs`. Cubre registro, acceso e inicio bancario a 320, 390, 780 y 1440 px; también saldos, carrusel, productos, accesos editables, notificaciones, filtros, simulación/cancelación, menú, perfil, sesión vencida y acceso sin sesión. Guarda las capturas en `/private/tmp/jose-*.png`. Esta prueba borra los datos de demostración de su perfil de pruebas.

Comprobación manual: enviar el formulario vacío, introducir un correo inválido, probar credenciales incorrectas, alternar la visibilidad de la contraseña, abrir y cerrar cada diálogo (también con Escape), iniciar sesión con las credenciales de prueba y cerrar sesión. Activar «Recordar usuario» y verificar que solo el correo se recupera al volver. Comprobar la vista en móvil y escritorio.

## Conectar autenticación real

Esta base demuestra el flujo de interfaz. Las credenciales de la cuenta inicial son públicas y los estados en el navegador no son una barrera de seguridad. Para producción, reemplaza `verifyCredentials` en `auth.js`, el manejo de sesión y `registro-service.js` por llamadas a un servidor que valide las credenciales, controle la unicidad de cuentas, emita y verifique OTP y autorice cada recurso, usando HTTPS y cookies de sesión HttpOnly/Secure. El proveedor de SMS y sus credenciales deben configurarse en el servidor. No incluyas contraseñas reales en el código del cliente. El servidor también debe implementar recuperación y registro/verificación de claves de acceso para biometría. Sustituye los términos y la política de la demo por los textos definitivos.
