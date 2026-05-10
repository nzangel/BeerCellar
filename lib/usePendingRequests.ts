import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';

/**
 * Retourne le nombre de demandes d'amis en attente (reçues, non acceptées).
 * Se met à jour en temps réel via la subscription Supabase.
 */
export function usePendingRequests(): number {
  const { session } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!session) return;

    const userId = session.user.id;

    const fetch = async () => {
      const { count: c } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('addressee_id', userId)
        .eq('status', 'pending');
      setCount(c ?? 0);
    };

    fetch();

    // Subscription temps réel : toute modification sur friendships reçues
    const channel = supabase
      .channel(`pending-requests-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
        },
        () => fetch()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user.id]);

  return count;
}
