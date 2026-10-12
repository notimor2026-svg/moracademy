# MOR Academy

Actúa como un Senior Product Engineer, UX/UI Designer, Systems Architect y Full-Stack Builder especializado en plataformas SaaS corporativas.
Necesito que construyas un nuevo módulo llamado MOR ACADEMY.

Este módulo debe servir para digitalizar, automatizar y mecanizar el proceso de inducción del personal y también la gestión de capacitaciones constantes dentro de una sola empresa.

Debes diseñarlo con una experiencia moderna, sobria, profesional y con elementos gamificados, de forma que sea entretenido y motivador, pero sin distraer al usuario de su aprendizaje.

Además, debes usar el logo proporcionado de MOR ACADEMY como identidad visual principal del módulo en login, dashboards, encabezados, certificados y elementos clave de marca.

1. Objetivo del módulo

Construir un sistema centralizado llamado MOR ACADEMY donde:

Los nuevos empleados puedan ingresar usando únicamente su DUI como login.

Recursos Humanos pueda crear previamente al empleado dentro del sistema con su DUI.

Al crear al empleado, RRHH podrá seleccionar desde un dropdown de requisiciones recién cerradas la requisición asociada a ese nuevo colaborador.

A partir de esa requisición cerrada, el sistema deberá jalar automáticamente las capacitaciones de inducción que el colaborador debe tomar.

Estas capacitaciones vendrán únicamente de lo que fue definido en la requisición dentro de MOR Talent Pipeline.

El sistema también debe servir para capacitaciones continuas o recurrentes, no solo para inducción.

Cada capacitación podrá incluir contenido como presentaciones, videos, documentos, evaluaciones, quizzes y certificados.

El sistema debe permitir que RRHH cree capacitaciones desde cero.

Los quizzes deben generarse automáticamente desde el contenido presentado hasta ese punto, estrictamente basados en dicho material.

2. Nombre del sistema

El nombre del sistema debe ser:

MOR ACADEMY

Debes reemplazar completamente cualquier referencia anterior a MOR Induction Hub por MOR ACADEMY.

3. Branding y estilo visual

Debes usar el logo adjunto de MOR ACADEMY como base de identidad visual.

Lineamientos visuales:

Estética corporativa moderna.

Mezcla sobria con elementos gamificados.

Limpia, profesional, elegante y amigable.

El diseño debe transmitir aprendizaje, progreso, orden y motivación.

La gamificación debe sentirse refinada y útil, nunca infantil.

El logo debe usarse en:

Pantalla de login.

Dashboard principal.

Menú lateral / navegación.

Encabezados.

Certificados.

Pantallas de bienvenida.

Emails del sistema cuando corresponda.

4. Alcance funcional general

MOR ACADEMY debe cubrir dos grandes funciones:

A. Inducción de nuevos empleados

El colaborador entra con su DUI.

Solo puede acceder si previamente fue registrado por RRHH.

RRHH lo crea manualmente.

RRHH le asigna una requisición cerrada desde un dropdown.

El sistema toma automáticamente las capacitaciones de inducción requeridas desde MOR Talent Pipeline.

B. Capacitaciones continuas

RRHH puede asignar capacitaciones adicionales a empleados ya existentes.

Estas pueden ser recurrentes, por cumplimiento, actualización o desarrollo continuo.

5. Tipos de usuario / roles

Debes crear al menos los siguientes roles:

5.1. Colaborador

Usuario final que toma las inducciones y capacitaciones.

Debe poder:

Ingresar usando únicamente su DUI.

Ver sus cursos asignados.

Ver su progreso.

Tomar cursos e inducciones.

Responder quizzes.

Ver su nota.

Reintentar evaluaciones según la configuración de cada capacitación.

Obtener certificados al aprobar.

Ver insignias, logros, ranking y recompensas visuales.

Consultar historial de capacitaciones completadas.

5.2. Recursos Humanos (Administrador)

Debe tener control total del módulo.

Debe poder:

Crear nuevos empleados con su DUI.

Asignar nombre, datos básicos y jefe directo.

Seleccionar una requisición cerrada desde un dropdown.

Jalar automáticamente las capacitaciones requeridas desde la requisición.

Crear capacitaciones desde cero.

Editar capacitaciones.

Subir materiales.

Definir reglas de aprobación.

Configurar intentos.

Configurar si requiere aprobación manual o no.

Asignar capacitaciones de inducción o constantes.

Ver reportes, auditoría, avance, notas, bloqueos y certificados.

Recibir notificaciones por correo cuando un empleado quede bloqueado.

Gestionar el contenido completo del sistema.

5.3. Jefe directo

Debe poder visualizar el avance de los empleados que le reportan directamente.

Debe poder:

Ver capacitaciones asignadas.

Ver avance.

Ver estado.

Ver si aprobó o no.

Ver si está bloqueado.

Ver certificados.

Dar seguimiento al cumplimiento.

Restricción de visibilidad:

La visibilidad de progreso y cumplimiento debe estar disponible solo para RRHH y el jefe directo.

6. Login y acceso

El sistema debe manejar un acceso muy simple:

Reglas:

El login debe ser únicamente con DUI.

No debe requerirse correo, contraseña, fecha de nacimiento ni segundo factor, salvo que se agregue en una futura versión.

El colaborador solo podrá entrar si fue previamente registrado por RRHH.

Si el DUI no existe, no podrá entrar.

Debe mostrarse un mensaje claro y profesional en caso de no encontrar al usuario.

7. Alta de nuevos empleados por RRHH

Debe existir un módulo donde RRHH pueda crear empleados manualmente.

Al crear un empleado, RRHH debe poder definir:

DUI

Nombre completo

Correo electrónico

Área

Cargo

Fecha de ingreso

Jefe directo

Estado del empleado

Tipo de proceso:

Inducción

Capacitación constante

Ambos

Flujo:

RRHH crea al empleado.

RRHH asigna el jefe directo.

RRHH selecciona desde un dropdown de requisiciones recién cerradas la requisición asociada.

El sistema jala automáticamente las capacitaciones de inducción definidas en esa requisición.

El empleado queda listo para ingresar con su DUI.

8. Integración con MOR Talent Pipeline

MOR ACADEMY debe integrarse con MOR Talent Pipeline, pero únicamente para obtener las capacitaciones de inducción requeridas desde una requisición cerrada.

Reglas de integración:

La integración debe leer requisiciones cerradas recientes.

Debe mostrar esas requisiciones en un dropdown al momento de crear el empleado.

Al seleccionar una requisición, el sistema debe traer solo:

Las capacitaciones requeridas para la inducción.

No hace falta traer toda la información del pipeline.

MOR Talent Pipeline funciona aquí como fuente de las capacitaciones de inducción definidas en la requisición.

9. Tipos de capacitación

El sistema debe soportar dos categorías:

9.1. Inducción

Asociada a nuevos ingresos.

Viene desde la requisición cerrada de MOR Talent Pipeline.

9.2. Capacitación constante

Creada desde cero por RRHH.

Puede asignarse manualmente a uno o varios empleados.

Puede servir para actualización, cumplimiento, formación recurrente o reforzamiento.

10. Creación de capacitaciones

RRHH debe poder crear capacitaciones desde cero.

Cada capacitación debe incluir:

Nombre

Descripción

Tipo:

Inducción

Capacitación constante

Duración estimada

Área aplicable

Cargo aplicable

Estado:

Borrador

Activa

Inactiva

Archivada

Vigencia

Nota mínima de aprobación

Cantidad máxima de intentos

Requiere aprobación manual: sí/no

Permite certificado: sí/no

Orden de los módulos

Reglas de desbloqueo

Reglas de navegación

11. Carga de contenido

Debes permitir que RRHH arme una capacitación desde cero con diferentes tipos de contenido.

Tipos de contenido permitidos:

Texto enriquecido

Presentaciones

PDFs

PowerPoint

Imágenes

Videos subidos directamente

Videos por enlace externo

Enlaces externos

Quizzes intermedios

Evaluación final

Recursos descargables

Regla importante:

Debes permitir ambas opciones para el contenido:

Carga directa de archivos

Uso de enlaces externos

El creador debe poder elegir libremente cómo cargar el material.

12. Estructura de cursos / capacitaciones

Cada capacitación debe poder organizarse por:

Módulos

Secciones

Lecciones

Recursos

Quizzes en puntos intermedios

Evaluación final

Debe existir un sistema de drag and drop para ordenar el contenido.

13. Control del avance

Sí debe existir control de avance obligatorio.

Reglas:

El usuario no debe poder saltarse contenido obligatorio.

Si un video es obligatorio, el sistema debe exigir que se visualice.

Si una sección debe completarse antes de otra, debe respetarse el orden.

El sistema debe controlar el avance real antes de habilitar el siguiente paso.

El usuario debe ver claramente qué ha completado y qué le falta.

14. Quizzes inteligentes generados por el sistema

Debe existir la opción de insertar quizzes en distintos puntos de la capacitación.

Comportamiento esperado:

Cuando RRHH inserte un quiz en determinado punto del curso, el sistema debe generar preguntas automáticamente usando solo el contenido que se presentó hasta ese momento.

Regla crítica y estricta:

Las preguntas deben:

Basarse estrictamente en el material presentado hasta el punto del quiz.

No inventar información.

No usar conocimiento externo.

No preguntar sobre contenido aún no mostrado.

Cambiar para cada persona.

Cambiar en cada intento.

Mantener dificultad equivalente entre intentos.

Apegarse estrictamente al contenido mostrado.

Tipos de pregunta:

Opción múltiple

Verdadero / falso

Múltiple respuesta

Relación de conceptos

Ordenamiento

Situacionales estrictamente basados en el contenido visto

Cada quiz debe permitir configurar:

Cantidad de preguntas

Puntaje por pregunta

Umbral mínimo

Retroalimentación inmediata

Intentos permitidos

Si es obligatorio o no

Si bloquea avance o no

Retroalimentación:

El sistema debe explicar por qué una respuesta es correcta o incorrecta, siempre basado en el contenido mostrado.

15. Evaluaciones e intentos

La cantidad de intentos no es global, sino que debe configurarla el creador de cada capacitación.

Reglas:

Cada capacitación podrá definir sus propios intentos máximos.

Cada intento debe generar preguntas distintas.

Si el usuario no aprueba y agota sus intentos:

Su acceso a esa capacitación debe quedar bloqueado.

Debe notificarse automáticamente a RRHH por correo.

RRHH debe poder desbloquear manualmente si así lo desea.

Debe guardarse historial de todos los intentos.

16. Regla de aprobación

La capacitación debe manejar una nota mínima configurable por el creador.

Regla base:

La nota mínima por defecto puede ser 80%, pero debe ser configurable.

Si el usuario alcanza la nota requerida, aprueba.

Si no la alcanza, reintenta según la configuración.

Si agota intentos, se bloquea y RRHH recibe notificación por correo.

17. Certificados

Sí debe haber certificados.

Requisitos:

Al aprobar una capacitación, el sistema debe poder generar un certificado.

El certificado debe incluir:

Logo de MOR ACADEMY

Nombre del colaborador

Nombre de la capacitación

Fecha de finalización

Nota obtenida

Código o identificador único del certificado

RRHH y el colaborador deben poder visualizarlo.

El jefe directo también debe poder verlo.

Puede descargarse o visualizarse en pantalla.

18. Gamificación

La experiencia debe ser motivadora, pero sobria y profesional.

Incluir:

Barra de progreso

Porcentaje de avance

Insignias

Logros

Niveles

Checklists de avance

Mensajes motivacionales sutiles

Recompensas visuales al completar hitos

Ranking visible para todos

Certificado de finalización

Historial de logros

Ejemplos de insignias:

Primer acceso

Primera capacitación iniciada

Primer quiz aprobado

50% completado

Inducción completada

100% de avance

Excelencia académica

Finalización sin reintentos

Restricción:

La gamificación debe ayudar a la motivación, no interrumpir el aprendizaje.

19. Dashboard del colaborador

El colaborador debe tener un dashboard claro y motivador.

Debe mostrar:

Bienvenida

Nombre

Cursos y capacitaciones asignadas

Estado de cada una

Progreso general

Próximos pasos

Certificados obtenidos

Insignias

Ranking

Capacitaciones vencidas o pendientes

Historial de actividades

20. Dashboard de RRHH

RRHH debe tener una consola robusta de administración.

Debe mostrar:

Total de empleados registrados

Total de empleados en inducción

Total de empleados en capacitaciones constantes

Empleados activos, pendientes, aprobados, reprobados y bloqueados

Capacitaciones activas

Tasa de aprobación

Tasa de reprobación

Capacitaciones con más bloqueos

Tiempo promedio de finalización

Certificados emitidos

Alertas

Próximos vencimientos

Actividad reciente

Tablas y filtros:

Buscar por DUI

Buscar por nombre

Filtrar por jefe directo

Filtrar por área

Filtrar por cargo

Filtrar por tipo de capacitación

Filtrar por estado

Filtrar por fechas

Filtrar por requisición

21. Dashboard del jefe directo

Debe existir una vista específica para el jefe directo.

Debe mostrar:

Empleados a su cargo

Capacitaciones asignadas a cada uno

Progreso

Estado

Fecha de inicio

Fecha de finalización

Bloqueos

Certificados

Alertas de incumplimiento

Visibilidad:

El jefe directo solo puede ver a los empleados que le fueron asignados.

22. Módulo de auditoría

Sí debe existir un módulo de auditoría completo.

Debe registrar:

Quién creó una capacitación

Quién creó un empleado

Quién editó una capacitación

Quién asignó una capacitación

Quién cambió estados

Quién desbloqueó usuarios

Intentos realizados

Fechas y horas de acceso

Resultados obtenidos

Emisión de certificados

Cambios administrativos relevantes

Objetivo:

Tener trazabilidad completa y evidencia de uso, avance y cumplimiento.

23. Módulo de reportes

Debe existir un módulo de reportes muy robusto.

Requerimiento clave:

Debe permitir crear reportes ad hoc personalizados usando toda la información disponible del sistema.

Debe permitir:

Elegir columnas

Elegir filtros

Elegir rangos de fecha

Guardar vistas de reporte

Reutilizar reportes

Agrupar resultados

Ordenar resultados

Ver totales y métricas

Exportar resultados

Información disponible para reportes:

Empleados

DUI

Jefe directo

Capacitaciones asignadas

Tipo de capacitación

Requisición asociada

Estado

Progreso

Notas

Intentos

Bloqueos

Certificados

Fechas de inicio y fin

Tiempos de finalización

Actividad

Auditoría

Logros gamificados

Exportación:

Permite exportar reportes al menos en:

Excel

CSV

PDF

24. Notificaciones

Sí debe haber notificaciones por correo.

Casos mínimos:

Cuando se asigna una capacitación

Cuando una capacitación está próxima a vencer

Cuando el usuario queda bloqueado

Cuando aprueba una capacitación

Cuando se emite un certificado

Cuando RRHH necesita intervenir

25. Seguridad y restricciones

Debes implementar:

Validación del formato de DUI

Acceso controlado por rol

El colaborador solo ve su información

El jefe directo solo ve a sus reportes directos

RRHH tiene visibilidad completa

Trazabilidad de acciones

Protección contra manipulación de resultados

Restricción para evitar saltarse contenidos

Registro completo de intentos y estados

26. Alcance organizacional

Este sistema es para una sola empresa.

Importante:

No necesitas arquitectura multiempresa en esta versión.

Todo el diseño puede asumir una sola organización.

27. Base de datos / entidades sugeridas

Diseña la estructura de datos necesaria para soportar todo el sistema.

Entidades recomendadas:

Usuarios

Roles

Empleados

Jefes directos

Requisiciones cerradas

Capacitaciones

Módulos

Secciones

Contenidos

Archivos

Enlaces externos

Quizzes

Preguntas generadas

Intentos

Respuestas

Resultados

Certificados

Insignias

Rankings

Auditoría

Reportes guardados

Notificaciones

Estados y bloqueos

28. UX/UI

Diseña una experiencia premium, clara y fácil de usar.

Debe ser:

Responsive

Mobile-friendly

Visualmente limpia

Intuitiva

Profesional

Moderna

Sobria con gamificación sutil

Orientada al aprendizaje

La navegación debe ser simple para:

Colaborador

RRHH

Jefe directo

29. Entregables esperados

Construye el módulo completo con:

Pantalla de login por DUI

Uso del logo MOR ACADEMY

Alta manual de empleados por RRHH

Asignación de jefe directo

Dropdown de requisiciones cerradas

Integración con MOR Talent Pipeline para traer capacitaciones de inducción

Dashboard del colaborador

Dashboard de RRHH

Dashboard del jefe directo

Creador de capacitaciones desde cero

Carga de contenido en múltiples formatos

Quizzes inteligentes

Configuración de intentos por capacitación

Bloqueo por agotamiento de intentos

Notificación por correo a RRHH

Certificados

Gamificación

Módulo de auditoría

Módulo de reportes ad hoc

Exportación de reportes

Seguridad por roles

Historial completo

Diseño responsive

30. Criterios de éxito

El proyecto se considera exitoso si:

El sistema se llama MOR ACADEMY.

Usa el logo proporcionado.

El colaborador puede ingresar solo con DUI.

RRHH puede crear manualmente empleados con DUI.

RRHH puede asignarles una requisición cerrada desde un dropdown.

El sistema jala automáticamente las capacitaciones de inducción desde MOR Talent Pipeline.

RRHH puede crear capacitaciones desde cero.

El contenido puede cargarse por archivo o enlace.

Los quizzes se generan solo con el contenido presentado.

Las preguntas cambian por intento y por persona.

La cantidad de intentos es configurable por capacitación.

Si se agotan los intentos, el usuario se bloquea y RRHH recibe correo.

El sistema emite certificados.

El sistema tiene gamificación sobria.

El jefe directo puede ver el avance de su personal.

Existe módulo de auditoría.

Existe módulo de reportes ad hoc.

Todo funciona para una sola empresa.

31. Instrucción final para Lovable

Construye MOR ACADEMY como un módulo robusto, elegante, escalable y orientado a la experiencia de usuario, priorizando:

Simplicidad de uso

Automatización del proceso de inducción

Trazabilidad

Aprendizaje efectivo

Gamificación profesional

Control administrativo total por RRHH

Integración funcional con MOR Talent Pipeline

Reportería y auditoría avanzadas

Debes entregar una solución bien estructurada, usable, clara y lista para evolucionar.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://moracademy.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ba79ecb9-8671-43ae-b2f8-4d49615a6265).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
