import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

/**
 * Full searchable emoji picker (emoji-mart) — thousands of emojis with search,
 * categories and skin tones, like ClickUp. Matches the app's light/dark theme.
 */
export default function EmojiPicker({ onPick }) {
  const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  return (
    <Picker
      data={data}
      theme={theme}
      previewPosition="none"
      navPosition="bottom"
      perLine={8}
      maxFrequentRows={2}
      onEmojiSelect={(e) => onPick(e.native)}
    />
  );
}
