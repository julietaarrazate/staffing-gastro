# Dirección «con relieve» (en prueba)

> Elegida por Julieta el 2026-11-17 para seguir: afinarla y llevarla a la app
> pantalla por pantalla, un PR cada una, **sin tocar la lógica**. Todavía no
> rige: lo vigente es [`marca-hoy.md`](./marca-hoy.md). Prueba navegable (en
> claro, con letra y acento intercambiables):
> https://claude.ai/artifact/WNXBXhkNgGrFdBbqFNsQan

## La idea

El relieve del «oído» fileteado (la sombra dura azul hondo, corrida abajo a la
derecha) pasa a ser la profundidad de la interfaz. En vez de sombras
difusas, **un objeto con relieve por pantalla**: el botón principal (ámbar,
letra tinta, sombra dura de 3 px que se aprieta al tocar) y la tarjeta que
importa (el turno para vos, el turno que se está buscando, el candidato
recomendado). Lo demás, plano y con hairline.

## Qué tiene la prueba

- **Landing:** avisos «en vivo» que flotan y se inclinan con el mouse, la
  palabra que cambia con un subrayado a mano en azul hondo, la comanda que se
  escribe, se arma y recibe el sello «¡Oído!», un radar sobre el mapa de
  Palermo con quién se postula, tres pasos con relieve, una cinta con los
  puestos y el cierre con el «oído» fileteado (sin el Sol de Mayo).
- **App:** el cielo arriba del Inicio, la tarjeta «Para vos, ahora» con foto,
  el detalle en una hoja que sube, «Me postulo» que se vuelve «¡Oído! Te
  avisamos si te eligen», el camino del turno (confirmado, salí, llegué,
  terminé), el panel del comercio con el reloj de los 10 minutos y el
  «¡Oído!» a pantalla completa al asignar. Barra de abajo flotante.

## Referencias de Julieta (2026-11-17)

Son ejemplos de nivel de cuidado, no estilos para copiar.

- **Web de clases particulares hecha con IA:** papel cuadriculado, tarjetas
  que reaccionan al mouse, fórmulas que se dibujan a mano, la palabra en
  cursiva que cambia. Se tomó: objetos que se mueven con el mouse, trazos a
  mano, la palabra que cambia.
- **Landing de una pizzería porteña:** títulos con voz de oficio, un objeto
  enorme y recortado por sección, el menú como carta con precios, lo local
  concreto (esquina, horarios, reseñas con nombre) y un «instructivo»
  numerado con notas a mano. Para la próxima vuelta: títulos que hablen como
  la cocina, personas recortadas sobre el cielo en vez de fotos en tarjetas,
  los planes como una carta de bodegón, minutos reales y barrios.
- **Microinteracciones de diseñador** (Tidemark y otras): un recibo que se
  imprime al elegir el plan y cambia el total, con una nota a mano en un
  círculo y el paisaje de fondo que pasa de tarde a noche; un interruptor de
  día y noche que es un paisajito; un mapa que se despliega con una lupa. Lo
  que pidió Julieta con esto: **evitar lo genérico de la IA**; cada efecto
  sale de un objeto real del oficio. Para Oído: la comanda que se imprime en
  los precios (papel de cocina, no recibo; la nota a mano en azul hondo), el
  riel de comandas en el panel del comercio (los turnos avanzan por el riel),
  el interruptor de tema como un cielito que pasa a la noche azul, y una lupa
  sobre el mapa de Palermo en «va en camino».

**Qué no se toma de ninguna:** la base crema con azul francia y la
ilustración de línea (es el terreno de Bachero; ver `marca-hoy.md`, regla 5).

## Antes de llevarla a la app

1. Afinar la prueba con lo que marque Julieta y mirarla en oscuro.
2. Definir los tokens nuevos (sombra dura, radio, tamaños del botón) en
   `globals.css` sin romper los que hay, con su ADR si cambia el sistema.
3. Un PR por pantalla, en este orden: Inicio del trabajador, Panel del
   comercio, Candidatos, Mis turnos, la landing. Capturas en claro y oscuro.
