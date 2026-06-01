# Förbundet Inv. — Plan

En privat webbapp för dig och dina vänner att planera golftävlingar tillsammans. Inbjudningsskyddad, realtidsuppdaterad, golfinspirerad design.

## Design

- **Palett:** Fairway Green — djup golfgrön (#0a1f14, #13402a) med fairway-grön accent (#2d8a5f) och cream (#f5f0e0)
- **Typografi:** Archivo Black (rubriker) + Hind (brödtext) — sportig och bold
- **Stil:** Modern klubbhuskänsla, mörk bakgrund, tydliga kort, snabb och lättnavigerad

## Funktioner

### 1. Konton & inloggning
- E-post + lösenord via Lovable Cloud
- **Inbjudningskod** krävs vid registrering (du genererar/delar koder)
- Profil: visningsnamn, avatar, handicap

### 2. Layout
- Topnav med logotyp "Förbundet Inv." och meny: **Chatt · Kalender · Profil**
- Mobilanpassat (bottom-nav på mobil)

### 3. Chatt (Messenger-stil)
- En gemensam gruppchatt, realtidsuppdaterad
- Like (👍) på meddelanden
- **Omröstningar** skapas direkt i chatten (fråga + alternativ + röst)
- Visar avatar, namn, tidsstämpel

### 4. Kalender
- Månadsvy med events
- Skapa event: titel, datum/tid, plats (golfbana), beskrivning, deltagare
- Anmäl dig / avanmäl dig
- Lista över kommande tävlingar

### 5. Profil
- Redigera namn, avatar, handicap
- Logga ut

## Teknisk del

**Stack:** React + Vite + Tailwind + shadcn + Lovable Cloud (Supabase)

**Databastabeller:**
- `profiles` (id, display_name, avatar_url, handicap) — auto via trigger på signup
- `invite_codes` (code, used_by, used_at) — koder du skapar manuellt
- `messages` (id, user_id, content, created_at)
- `message_likes` (message_id, user_id)
- `polls` (id, message_id, question)
- `poll_options` (id, poll_id, text)
- `poll_votes` (poll_id, option_id, user_id)
- `events` (id, title, start_at, location, description, created_by)
- `event_attendees` (event_id, user_id, status)

**Säkerhet:**
- RLS på alla tabeller — bara inloggade ser/skriver data
- Signup verifierar inbjudningskod via edge function (markerar koden använd)
- Avatar-uppladdning via Storage bucket

**Realtid:** Supabase Realtime på `messages`, `message_likes`, `poll_votes`, `events` för direktuppdateringar.

## Leverans (bygg-ordning)
1. Aktivera Lovable Cloud + databasschema + RLS
2. Auth med inbjudningskod + profil
3. Layout, navigation, golf-tema
4. Chatt med likes och realtid
5. Omröstningar i chatten
6. Kalender med events och anmälningar
7. Profilsida med avatar/handicap

Efter godkännande skapar jag första inbjudningskoden åt dig så du kan registrera dig.