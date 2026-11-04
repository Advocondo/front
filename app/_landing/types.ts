/** Resposta de GET /landing. Ver docs/landing.md no repositório do back. */
export type LandingContent = {
  hero: { title: string; subtitle: string; button_label: string };
  practice_areas: {
    title: string;
    areas: { title: string; description: string }[];
    closing_text: string;
  };
  online_service: { title: string; text: string; button_label: string };
  condominium_advisory: { title: string; paragraphs: string[] };
  reviews: {
    title: string;
    reviews: { author: string; author_details: string | null; rating: number; text: string }[];
    call_to_review_title: string;
    call_to_review_text: string;
    button_label: string;
    google_reviews_url: string | null;
  };
  why_us: { title: string; paragraphs: string[]; button_label: string };
  team: {
    title: string;
    members: { name: string; role: string; photo_id: string | null }[];
    highlights: string[];
  };
  contact_form: { title: string; subtitle: string };
  visit: { title: string; text: string; button_label: string };
  contact: {
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    address: string | null;
    opening_hours: string | null;
    facebook_url: string | null;
    instagram_url: string | null;
  };
};

export type ContactMessage = {
  name: string;
  phone: string;
  email: string;
  message: string | null;
  website: string;
  captcha_token: string;
};
