// Handle Web Share Target API — receives audio files shared from iOS (e.g. call recordings)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname === '/share-target' && event.request.method === 'POST') {
    event.respondWith(handleShareTarget(event.request));
  }
});

async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('audio');

    if (file && file instanceof File) {
      const cache = await caches.open('shared-files');
      await cache.put('/shared-audio-file', new Response(file, {
        headers: {
          'Content-Type': file.type || 'audio/mp4',
          'X-File-Name': encodeURIComponent(file.name),
        },
      }));
    }
  } catch (e) {
    // If form parsing fails, still redirect gracefully
  }

  return Response.redirect('/voice?shared=1', 303);
}
