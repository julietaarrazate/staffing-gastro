/**
 * Ubicaciones de Argentina para el selector de turnos.
 *
 * Arranca por los 48 barrios de la Ciudad Autónoma de Buenos Aires (CABA),
 * que es donde se concentra el primer mercado, y sigue con las provincias y
 * ciudades principales. Cada localidad trae una coordenada aproximada (el
 * centro del barrio/ciudad) para alimentar el matching por distancia sin
 * pedirle al comercio que cargue latitud/longitud a mano.
 *
 * Para sumar más ciudades, agregá entradas a la provincia correspondiente.
 */

export type Locality = {
  name: string;
  lat: number;
  lng: number;
};

export type Province = {
  name: string;
  /** Etiqueta del nivel inferior: "Barrio" para CABA, "Ciudad" para el resto. */
  localityLabel: string;
  localities: Locality[];
};

const CABA_BARRIOS: Locality[] = [
  { name: "Agronomía", lat: -34.5934, lng: -58.4884 },
  { name: "Almagro", lat: -34.6106, lng: -58.4214 },
  { name: "Balvanera", lat: -34.6097, lng: -58.4017 },
  { name: "Barracas", lat: -34.648, lng: -58.3815 },
  { name: "Belgrano", lat: -34.5627, lng: -58.4584 },
  { name: "Boedo", lat: -34.628, lng: -58.4172 },
  { name: "Caballito", lat: -34.619, lng: -58.4406 },
  { name: "Chacarita", lat: -34.5874, lng: -58.4538 },
  { name: "Coghlan", lat: -34.5604, lng: -58.4748 },
  { name: "Colegiales", lat: -34.5747, lng: -58.4494 },
  { name: "Constitución", lat: -34.628, lng: -58.3815 },
  { name: "Flores", lat: -34.638, lng: -58.464 },
  { name: "Floresta", lat: -34.629, lng: -58.487 },
  { name: "La Boca", lat: -34.6345, lng: -58.3631 },
  { name: "La Paternal", lat: -34.5969, lng: -58.4658 },
  { name: "Liniers", lat: -34.6433, lng: -58.5208 },
  { name: "Mataderos", lat: -34.6585, lng: -58.5034 },
  { name: "Monte Castro", lat: -34.619, lng: -58.5054 },
  { name: "Monserrat", lat: -34.6126, lng: -58.3816 },
  { name: "Nueva Pompeya", lat: -34.6541, lng: -58.417 },
  { name: "Núñez", lat: -34.546, lng: -58.4569 },
  { name: "Palermo", lat: -34.5775, lng: -58.4256 },
  { name: "Parque Avellaneda", lat: -34.647, lng: -58.48 },
  { name: "Parque Chacabuco", lat: -34.6357, lng: -58.44 },
  { name: "Parque Chas", lat: -34.5856, lng: -58.4799 },
  { name: "Parque Patricios", lat: -34.6363, lng: -58.4007 },
  { name: "Puerto Madero", lat: -34.6105, lng: -58.363 },
  { name: "Recoleta", lat: -34.5875, lng: -58.3974 },
  { name: "Retiro", lat: -34.5921, lng: -58.3744 },
  { name: "Saavedra", lat: -34.5546, lng: -58.488 },
  { name: "San Cristóbal", lat: -34.623, lng: -58.401 },
  { name: "San Nicolás", lat: -34.6039, lng: -58.3816 },
  { name: "San Telmo", lat: -34.6214, lng: -58.3731 },
  { name: "Vélez Sársfield", lat: -34.6357, lng: -58.492 },
  { name: "Versalles", lat: -34.63, lng: -58.523 },
  { name: "Villa Crespo", lat: -34.599, lng: -58.439 },
  { name: "Villa del Parque", lat: -34.608, lng: -58.492 },
  { name: "Villa Devoto", lat: -34.599, lng: -58.513 },
  { name: "Villa General Mitre", lat: -34.611, lng: -58.469 },
  { name: "Villa Lugano", lat: -34.676, lng: -58.472 },
  { name: "Villa Luro", lat: -34.636, lng: -58.502 },
  { name: "Villa Ortúzar", lat: -34.581, lng: -58.467 },
  { name: "Villa Pueyrredón", lat: -34.584, lng: -58.5 },
  { name: "Villa Real", lat: -34.621, lng: -58.526 },
  { name: "Villa Riachuelo", lat: -34.688, lng: -58.466 },
  { name: "Villa Santa Rita", lat: -34.615, lng: -58.482 },
  { name: "Villa Soldati", lat: -34.67, lng: -58.442 },
  { name: "Villa Urquiza", lat: -34.572, lng: -58.49 },
];

export const PROVINCES: Province[] = [
  {
    name: "Ciudad Autónoma de Buenos Aires",
    localityLabel: "Barrio",
    localities: CABA_BARRIOS,
  },
  {
    name: "Buenos Aires (GBA y provincia)",
    localityLabel: "Ciudad",
    localities: [
      { name: "La Plata", lat: -34.9215, lng: -57.9545 },
      { name: "Mar del Plata", lat: -38.0055, lng: -57.5426 },
      { name: "Bahía Blanca", lat: -38.7196, lng: -62.2724 },
      { name: "Tandil", lat: -37.3217, lng: -59.1332 },
      { name: "Avellaneda", lat: -34.6628, lng: -58.3648 },
      { name: "Lanús", lat: -34.7036, lng: -58.3918 },
      { name: "Quilmes", lat: -34.7203, lng: -58.2654 },
      { name: "San Isidro", lat: -34.4708, lng: -58.5123 },
      { name: "Tigre", lat: -34.426, lng: -58.5796 },
      { name: "Morón", lat: -34.6534, lng: -58.6198 },
      { name: "San Justo (La Matanza)", lat: -34.6776, lng: -58.5612 },
      { name: "Pilar", lat: -34.4585, lng: -58.9142 },
    ],
  },
  {
    name: "Córdoba",
    localityLabel: "Ciudad",
    localities: [
      { name: "Córdoba Capital", lat: -31.4201, lng: -64.1888 },
      { name: "Villa Carlos Paz", lat: -31.4241, lng: -64.4978 },
      { name: "Río Cuarto", lat: -33.1232, lng: -64.3493 },
    ],
  },
  {
    name: "Santa Fe",
    localityLabel: "Ciudad",
    localities: [
      { name: "Rosario", lat: -32.9442, lng: -60.6505 },
      { name: "Santa Fe Capital", lat: -31.6107, lng: -60.6973 },
    ],
  },
  {
    name: "Mendoza",
    localityLabel: "Ciudad",
    localities: [{ name: "Mendoza Capital", lat: -32.8895, lng: -68.8458 }],
  },
  {
    name: "Tucumán",
    localityLabel: "Ciudad",
    localities: [
      { name: "San Miguel de Tucumán", lat: -26.8083, lng: -65.2176 },
    ],
  },
  {
    name: "Salta",
    localityLabel: "Ciudad",
    localities: [{ name: "Salta Capital", lat: -24.7821, lng: -65.4232 }],
  },
  {
    name: "Neuquén",
    localityLabel: "Ciudad",
    localities: [{ name: "Neuquén Capital", lat: -38.9516, lng: -68.0591 }],
  },
  {
    name: "Río Negro",
    localityLabel: "Ciudad",
    localities: [
      { name: "San Carlos de Bariloche", lat: -41.1335, lng: -71.3103 },
    ],
  },
  {
    name: "Entre Ríos",
    localityLabel: "Ciudad",
    localities: [{ name: "Paraná", lat: -31.7319, lng: -60.5238 }],
  },
];
