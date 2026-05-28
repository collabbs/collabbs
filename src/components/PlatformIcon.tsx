import type { IconType } from "react-icons";
import {
  SiTiktok,
  SiInstagram,
  SiYoutube,
  SiFacebook,
  SiSnapchat,
  SiX,
  SiTwitch,
} from "react-icons/si";
import { FaLinkedin } from "react-icons/fa6";

// Mappé sur les slugs de la table `platforms`.
const META: Record<string, { Icon: IconType; color: string }> = {
  tiktok: { Icon: SiTiktok, color: "#000000" },
  instagram: { Icon: SiInstagram, color: "#E4405F" },
  youtube: { Icon: SiYoutube, color: "#FF0000" },
  facebook: { Icon: SiFacebook, color: "#1877F2" },
  snapchat: { Icon: SiSnapchat, color: "#EAB308" },
  linkedin: { Icon: FaLinkedin, color: "#0A66C2" },
  twitter: { Icon: SiX, color: "#000000" },
  twitch: { Icon: SiTwitch, color: "#9146FF" },
};

export default function PlatformIcon({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}) {
  const meta = META[slug];
  if (!meta) return null;
  const { Icon, color } = meta;
  return <Icon className={className} style={{ color }} />;
}
