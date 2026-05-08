export type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
};

export type Beer = {
  id: string;
  barcode: string | null;
  name: string;
  brewery: string | null;
  style: string | null;
  abv: number | null;
  ibu: number | null;
  description: string | null;
  image_url: string | null;
  country: string | null;
  created_at: string;
};

export type TasteTag =
  | 'café'
  | 'cerise'
  | 'vanille'
  | 'chocolat'
  | 'caramel'
  | 'agrumes'
  | 'houblon'
  | 'malt'
  | 'fumé'
  | 'fruits rouges'
  | 'épices'
  | 'banane'
  | 'miel'
  | 'noix'
  | 'floral'
  | 'herbacé'
  | 'réglisse'
  | 'pain grillé'
  | 'boisé'
  | 'acidulé';

export const TASTE_TAGS: TasteTag[] = [
  'café', 'cerise', 'vanille', 'chocolat', 'caramel',
  'agrumes', 'houblon', 'malt', 'fumé', 'fruits rouges',
  'épices', 'banane', 'miel', 'noix', 'floral',
  'herbacé', 'réglisse', 'pain grillé', 'boisé', 'acidulé',
];

export type CellarEntry = {
  id: string;
  user_id: string;
  beer_id: string;
  beer?: Beer;
  rating: number | null;
  notes: string | null;
  taste_tags: TasteTag[];
  photo_url: string | null;
  quantity: number;
  is_favorite: boolean;
  added_at: string;
};

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  profile?: Profile;
};

export type TastingGroup = {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
  member_count?: number;
};

export type GroupMember = {
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  profile?: Profile;
};

export type GroupSession = {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  created_by: string;
  created_at: string;
};

export type SessionBeer = {
  id: string;
  session_id: string;
  beer_id: string;
  beer?: Beer;
  added_by: string;
};

export type SessionRating = {
  id: string;
  session_id: string;
  beer_id: string;
  user_id: string;
  rating: number;
  notes: string | null;
  taste_tags: TasteTag[];
  created_at: string;
};
