(function (root) {
  'use strict';
  const IMAGE_SOURCE_TYPES = new Set(['image/webp', 'image/png', 'image/jpeg']);
  const AUDIO_BY_EXTENSION = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', webm: 'audio/webm', m4a: 'audio/mp4' };
  let playing = null;

  function audioType(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    const mime = AUDIO_BY_EXTENSION[extension];
    const aliases = { 'audio/mpeg': ['audio/mp3'], 'audio/wav': ['audio/x-wav'], 'audio/mp4': ['audio/x-m4a'] };
    if (!mime || (file.type && ![mime, ...(aliases[mime] || [])].includes(file.type))) throw new Error('unsupportedAudio');
    if (!document.createElement('audio').canPlayType(mime)) throw new Error('unsupportedAudio');
    return mime;
  }

  function readDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('mediaReadFailed'));
      reader.readAsDataURL(file);
    });
  }

  async function importAudio(file) {
    const mime = audioType(file);
    if (!file.size || file.size > 4_000_000) throw new Error('audioTooLarge');
    const raw = await readDataURL(file);
    const data = `data:${mime};base64,${raw.slice(raw.indexOf(',') + 1)}`;
    return { mime, data };
  }

  async function importImage(file) {
    if ((file.type && !IMAGE_SOURCE_TYPES.has(file.type)) || (!file.type && !/\.(webp|png|jpe?g)$/i.test(file.name))) throw new Error('unsupportedImage');
    if (!file.size || file.size > 12_000_000) throw new Error('imageTooLarge');
    const url = URL.createObjectURL(file);
    try {
      const picture = new Image();
      await new Promise((resolve, reject) => {
        picture.onload = resolve;
        picture.onerror = () => reject(new Error('mediaReadFailed'));
        picture.src = url;
      });
      if (!picture.naturalWidth || !picture.naturalHeight) throw new Error('mediaReadFailed');
      const scale = Math.min(1, 1024 / picture.naturalWidth, 1024 / picture.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(picture.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(picture.naturalHeight * scale));
      canvas.getContext('2d').drawImage(picture, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/webp', .82);
      if (!data.startsWith('data:image/webp;base64,')) throw new Error('unsupportedImage');
      if (data.length > 2_200_000) throw new Error('imageTooLarge');
      return { mime: 'image/webp', data };
    } catch (error) {
      if (['unsupportedImage', 'imageTooLarge'].includes(error.message)) throw error;
      throw new Error('mediaReadFailed');
    } finally { URL.revokeObjectURL(url); }
  }

  function stop() {
    if (playing) { playing.pause(); playing.removeAttribute('src'); playing.load(); playing = null; }
  }

  function play(asset, onError) {
    stop();
    if (!asset || !asset.mime.startsWith('audio/')) { onError(); return; }
    const audio = new Audio();
    playing = audio;
    audio.src = asset.data;
    audio.onerror = () => { if (playing === audio) { stop(); onError(); } };
    audio.onended = () => { if (playing === audio) playing = null; };
    audio.play().catch(() => { if (playing === audio) { stop(); onError(); } });
  }

  root.WordsMedia = { importImage, importAudio, play, stop };
})(globalThis);
