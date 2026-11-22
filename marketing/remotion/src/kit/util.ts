export const hora = (f: number, marcas: [number, string][]) => {
  let h = marcas[0][1];
  for (const [k, v] of marcas) if (f >= k) h = v;
  return h;
};
