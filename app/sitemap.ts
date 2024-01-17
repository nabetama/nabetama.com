import { MetadataRoute } from "next";
import { allPosts } from "contentlayer/generated";

export default function sitemap(): MetadataRoute.Sitemap {
  const blogPosts = allPosts.map((post) => ({
    url: `https://nabetama.com${post.slug}`,
    lastModified: post.modDate || post.date,
    priority: 0.7,
  }));

  return [
    {
      url: "https://nabetama.com",
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 1,
    },
    {
      url: "https://nabetama.com/about",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://blog.nabetama.com",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },
    ...blogPosts,
  ];
}
