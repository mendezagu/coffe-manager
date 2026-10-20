// Achica el logo antes de subirlo: el servidor lo guarda en la base y lo manda en cada ticket.
const LOGO_MAX_SIDE = 256;
const LOGO_MAX_CHARS = 300_000;

export function shrinkImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, LOGO_MAX_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas'));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let data = canvas.toDataURL('image/png');
      if (data.length > LOGO_MAX_CHARS) data = canvas.toDataURL('image/jpeg', 0.85);
      data.length > LOGO_MAX_CHARS ? reject(new Error('size')) : resolve(data);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('load'));
    };
    img.src = url;
  });
}
