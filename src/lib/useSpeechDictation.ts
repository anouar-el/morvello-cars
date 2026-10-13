import { useCallback, useEffect, useRef, useState } from 'react';

/*
 * Dictée vocale via l'API Web Speech du navigateur (Chrome, Edge, Safari ; absente de Firefox).
 * Le traitement de la voix est fait par le navigateur / son fournisseur, pas par ce serveur.
 */

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Micro refusé : autorisez-le dans les réglages du navigateur.',
  'service-not-allowed': 'Dictée vocale indisponible sur ce navigateur.',
  'audio-capture': 'Aucun micro détecté.',
  network: 'Dictée vocale indisponible (réseau).',
};

function getRecognitionCtor(): (new () => RecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useSpeechDictation(opts: { lang: string; onTranscript: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<RecognitionLike | null>(null);
  const onTranscriptRef = useRef(opts.onTranscript);
  onTranscriptRef.current = opts.onTranscript;

  const supported = getRecognitionCtor() !== null;

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      // déjà arrêté
    }
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    setError(null);

    const rec = new Ctor();
    rec.lang = opts.lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: any) => {
      let text = '';
      for (let i = 0; i < e.results.length; i += 1) text += e.results[i][0]?.transcript ?? '';
      onTranscriptRef.current(text.trim());
    };
    rec.onerror = (e: any) => {
      const code = String(e?.error || '');
      if (code && code !== 'no-speech' && code !== 'aborted') {
        setError(ERROR_MESSAGES[code] || 'La dictée vocale a rencontré un problème.');
      }
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
      recRef.current = null;
    }
  }, [opts.lang]);

  useEffect(() => () => recRef.current?.abort(), []);

  return { supported, listening, error, start, stop };
}
