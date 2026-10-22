export type ShareNetwork = 'x' | 'facebook' | 'linkedin' | 'whatsapp';

export function shareLinks(url: string, text: string): Record<ShareNetwork, string> {
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);
  return {
    x: `https://x.com/intent/post?url=${encodedUrl}&text=${encodedText}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
  };
}
