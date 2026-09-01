// Client-side image optimizer to speed up uploads and ensure pristine OCR legibility.
// Shared by ReceiptOcrView (expense receipts) and SalesEntryView (income/deposit proof).
export function optimizeImage(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDim = 1800;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.90);
          resolve({ base64: compressed, mimeType: 'image/jpeg' });
          return;
        }
        resolve({ base64: src, mimeType: file.type || 'image/jpeg' });
      };
      img.onerror = () => {
        resolve({ base64: src, mimeType: file.type || 'image/jpeg' });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
