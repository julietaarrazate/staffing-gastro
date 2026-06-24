This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | URL base del backend (ver `.env.production`). |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloud name de la cuenta de [Cloudinary](https://cloudinary.com) usada para subir foto de perfil/logo. |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Nombre de un *upload preset* **unsigned** en esa cuenta de Cloudinary (Settings → Upload → Upload presets → Add upload preset, Signing mode: Unsigned). |

Sin estas dos últimas, el botón de subir foto en `/profile` muestra un error
("La subida de imágenes no está configurada todavía") pero el resto de la
app funciona igual: la subida va directo del navegador a Cloudinary (no pasa
por nuestro backend) y sólo guardamos la URL resultante en `photo_url`/`logo_url`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
