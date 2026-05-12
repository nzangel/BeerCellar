import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type VersionStatus = 'ok' | 'outdated' | 'unknown';

export function useVersionCheck(): { status: VersionStatus; message: string } {
  const [status, setStatus] = useState<VersionStatus>('unknown');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const check = async () => {
      try {
        const { data } = await supabase
          .from('app_config')
          .select('min_version_code, update_message')
          .eq('id', 1)
          .single();

        if (!data) return;

        const currentVersionCode = Constants.expoConfig?.android?.versionCode ?? 0;
        if (currentVersionCode < data.min_version_code) {
          setMessage(data.update_message ?? 'Une mise à jour est disponible.');
          setStatus('outdated');
        } else {
          setStatus('ok');
        }
      } catch {
        setStatus('unknown');
      }
    };

    check();
  }, []);

  return { status, message };
}
