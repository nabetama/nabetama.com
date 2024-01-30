import { allPosts } from 'contentlayer/generated'
import { compareDesc, format } from 'date-fns'
import Link from 'next/link'

export default function Home() {
  const posts = allPosts.sort((a, b) => compareDesc(new Date(a.date), new Date(b.date)))

  return (
    <div className="prose dark:prose-invert">
      {posts.slice(0, 6).map((post) => (
        <article className="mt-10" key={post._id}>
          <time
            className="dark:text-gray-400 no-underline mt-3 p-0 block text-[.8rem]"
            dateTime={post.date}
          >
            {format(post.date, 'yyyy年MM月dd日')}
          </time>
          <Link className="text-xl dark:hover:bg-fuchsia-600" href={post.slug}>
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
  )
}
