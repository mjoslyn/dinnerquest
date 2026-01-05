import { Link } from "react-router";
import type { ReactNode } from "react";

interface GameLayoutProps {
  children: ReactNode;
  theme?: string;
  title?: string;
  subtitle?: string;
}

const themeSubtitles: Record<string, string> = {
  'theme-fantasy': 'A culinary adventure',
  'theme-cyberpunk': 'A meal planning simulation',
  'theme-western': 'A meal wrangling game',
  'theme-noir': 'A culinary mystery',
  'theme-pirate': 'A meal treasure hunt',
  'theme-medieval': 'A royal banquet quest',
  'theme-space': 'A deep space meal protocol',
  'theme-horror': 'A haunted meal quest'
};

const themeTitles: Record<string, string> = {
  'theme-fantasy': 'DINNER QUEST',
  'theme-cyberpunk': 'SUSTENANCE.EXE',
  'theme-western': 'GRUB SHOWDOWN',
  'theme-noir': 'CASE: MISSING MEALS',
  'theme-pirate': 'HIGH SEAS FEAST',
  'theme-medieval': 'THE FEAST DECREE',
  'theme-space': 'MISSION: SUSTENANCE',
  'theme-horror': 'THE CURSED KITCHEN'
};

export default function GameLayout({
  children,
  theme = 'theme-fantasy',
  title,
  subtitle
}: GameLayoutProps) {
  const displayTitle = title || themeTitles[theme] || 'DINNER QUEST';
  const displaySubtitle = subtitle || themeSubtitles[theme] || 'A meal planning roguelike';

  return (
    <div className="container">
      <header className="header">
        <h1 className="title">
          <Link to="/" className="title-link">
            🍽️ {displayTitle}
          </Link>
        </h1>
        <p className="subtitle">{displaySubtitle}</p>
      </header>
      {children}
    </div>
  );
}
