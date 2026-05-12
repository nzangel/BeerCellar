import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';

export type BadgeType = 'developpeur' | 'fondateur' | 'vip' | 'utilisateur';

const BADGE_IMAGES: Record<BadgeType, any> = {
  developpeur: require('../assets/badge_developpeur.png'),
  fondateur: require('../assets/badge_fondateur.png'),
  vip: require('../assets/badge_vip.png'),
  utilisateur: require('../assets/badge_utilisateur.png'),
};

const BADGE_LABELS: Record<BadgeType, string> = {
  developpeur: 'Développeur',
  fondateur: 'Fondateur',
  vip: 'VIP',
  utilisateur: 'Utilisateur',
};

interface UserBadgeProps {
  badge: BadgeType | string | null | undefined;
  size?: number;
}

export default function UserBadge({ badge, size = 44 }: UserBadgeProps) {
  const [lightbox, setLightbox] = useState(false);

  if (!badge) return null;
  const key = badge as BadgeType;
  const source = BADGE_IMAGES[key];
  if (!source) return null;

  return (
    <>
      <Pressable onPress={() => setLightbox(true)} hitSlop={8}>
        <Image source={source} style={{ width: size, height: size }} contentFit="contain" />
      </Pressable>

      <Modal
        visible={lightbox}
        transparent
        animationType="fade"
        onRequestClose={() => setLightbox(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setLightbox(false)}>
          <View style={styles.lightboxContent}>
            <Image source={source} style={styles.fullImage} contentFit="contain" />
            <Text style={styles.label}>{BADGE_LABELS[key]}</Text>
          </View>
          <Pressable style={styles.closeBtn} onPress={() => setLightbox(false)}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxContent: {
    alignItems: 'center',
    gap: 20,
  },
  fullImage: {
    width: 220,
    height: 220,
  },
  label: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 6,
  },
});
