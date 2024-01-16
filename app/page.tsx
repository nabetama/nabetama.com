import { allPosts } from "contentlayer/generated";
import { compareDesc } from "date-fns";
import Link from "next/link";

const formatDate = (inputDate: string) => {
  const date = new Date(inputDate);

  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };

  const formattedDate = new Intl.DateTimeFormat("ja-JP", options).format(date);
  return formattedDate
    .replace(/\//g, "年")
    .replace("-", "月")
    .replace("T", "日")
    .replace("Z", "");
};

export default function Home() {
  const posts = allPosts.sort((a, b) =>
    compareDesc(new Date(a.date), new Date(b.date))
  );

  return (
    <div className="prose dark:prose-invert">
      {posts.slice(0, 6).map((post) => (
        <article className="mt-10" key={post._id}>
          <time
            className="text-gray-400 no-underline mt-3 p-0 block text-[.8rem]"
            dateTime={post.date}
          >
            {formatDate(post.date)}日
          </time>
          <Link className="text-xl" href={post.slug}>
            {post.title}
          </Link>
          {post.description && <p>{post.description}</p>}
        </article>
      ))}
      <article className="mt-10">
        <Link className="text-xl" href="/posts">
          ⇢すべての記事を見る
        </Link>
      </article>
    </div>
  );
}
