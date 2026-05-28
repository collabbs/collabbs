import Link from "next/link";
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
import type { IconType } from "react-icons";

const NETWORKS: { label: string; Icon: IconType }[] = [
  { label: "TikTok", Icon: SiTiktok },
  { label: "Instagram", Icon: SiInstagram },
  { label: "YouTube", Icon: SiYoutube },
  { label: "Facebook", Icon: SiFacebook },
  { label: "Snapchat", Icon: SiSnapchat },
  { label: "LinkedIn", Icon: FaLinkedin },
  { label: "Twitter / X", Icon: SiX },
  { label: "Twitch", Icon: SiTwitch },
];

export default function NetworkLinks() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 lg:justify-start lg:gap-2">
      {NETWORKS.map(({ label, Icon }) => (
        <Link
          key={label}
          href={`/creators?platform=${encodeURIComponent(label)}`}
          title={label}
          aria-label={`Créateurs ${label}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-50 text-zinc-500 ring-1 ring-zinc-100 transition hover:-translate-y-0.5 hover:bg-white hover:text-ink hover:shadow-sm lg:h-9 lg:w-9"
        >
          <Icon className="h-4 w-4 lg:h-[18px] lg:w-[18px]" />
        </Link>
      ))}
    </div>
  );
}
