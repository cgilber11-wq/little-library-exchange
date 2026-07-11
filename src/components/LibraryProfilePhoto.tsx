import { isSeedLibraryPhoto } from "@/lib/library-photo-constants";

type Props = {
  src: string;
  alt: string;
  className?: string;
};

export function LibraryProfilePhoto({ src, alt, className = "" }: Props) {
  const pixelArt = isSeedLibraryPhoto(src);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={[
        "aspect-[4/3] w-full",
        pixelArt ? "image-pixelated bg-cream-50 object-contain p-3 sm:p-4" : "object-cover",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
