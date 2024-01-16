import Link from "next/link";

export default function Footer() {
  return (
    <footer className="container mx-auto max-w-2xl px-4 py-12 text-sm leading-loose">
      <nav>
        <ul className="list-disc ml-3">
          <li>
            <Link
              className="text-gray-200 decoration-inherit hover:underline"
              href="/"
            >
              ホーム
            </Link>
          </li>
          <li>
            <Link
              className="text-gray-200 decoration-inherit hover:underline"
              href="/posts"
            >
              記事一覧
            </Link>
          </li>
          <li>
            <Link
              className="text-gray-200 decoration-inherit hover:underline"
              href="/about"
            >
              このサイトについて
            </Link>
          </li>
        </ul>
      </nav>
    </footer>
  );
}
