export interface Story {
  slug: string;
  title: string;
  date: string;
  /** Display duration shown on overlays, e.g. "2:06" */
  duration: string | null;
  description: string;
  image: string | null;
  alt: string;
  video: string | null;
  body: string[];
}

export const stories: Story[] = [
  {
    slug: 'illegal-donations',
    title: 'Illegal Donations in Project 2025',
    date: '06 July 2026',
    duration: '2:06',
    description:
      'We spent six months filming undercover inside Project 2025. Our investigation reveals evidence of illegal activity, corruption and secret corporate influence.',
    image: '/images/donations.jpg',
    alt: 'Black-and-white still of people holding hands in a crowded hall',
    video: '/videos/donations.mp4',
    body: [
      'For six months, two Verbatim reporters worked undercover inside the fundraising operation at the centre of this investigation. What began as a routine review of public donation records became a detailed map of how money moves when it is not supposed to be seen — through intermediaries, private events and accounts that never appear in any official filing.',
      'The footage gathered during that period, some of which appears in the film above, documents conversations in which staff and consultants describe routing contributions through third parties in order to keep the names of the true donors out of public disclosures. Legal experts who reviewed our evidence described the arrangements as, at minimum, a deliberate effort to defeat transparency rules — and potentially a criminal offence.',
      'The paper trail supports what the cameras recorded. Internal documents obtained by Verbatim show payments passing through a chain of companies with no staff, no offices and no apparent purpose beyond receiving and forwarding money. Within days of each transfer, donations of near-identical amounts appear in the accounts of affiliated campaign vehicles.',
      'Those named in this investigation were given two weeks to respond. Their responses, where provided, are included in the full written report and addressed in the film. Several declined to comment; one threatened legal action against this organisation before withdrawing the threat without explanation.',
      'This investigation is ongoing. If you have information relating to any of the individuals or organisations involved, you can contact our reporters securely. Verbatim is funded by its readers — independent journalism like this is only possible because of your support.',
    ],
  },
  {
    slug: 'corrupt-think-tank',
    title: 'The Corrupt Think Tank',
    date: '06 July 2026',
    duration: '2:06',
    description:
      'We spent six months filming undercover inside Project 2025. Our investigation reveals evidence of illegal activity, corruption and secret corporate influence.',
    image: '/images/think-tank.jpg',
    alt: 'Blurred black-and-white photograph of a woman walking through a city street',
    video: '/videos/think-tank.mp4',
    body: [
      'It presents itself as an independent research institute: a charity producing impartial analysis for policymakers and the public. Behind closed doors, our reporting found an organisation whose research conclusions were available to the highest bidder — and whose funders were promised influence over the reports that carried its name.',
      'Undercover recordings show senior staff offering prospective donors the opportunity to shape research agendas, review drafts before publication and place their arguments in briefings sent to legislators — all while the organisation publicly maintained that its funders had no editorial input of any kind.',
      'Charity regulations require organisations of this kind to operate for the public benefit and to guard their independence. Regulatory specialists who examined our evidence said the arrangements we documented could amount to a serious breach of those requirements, and called for a formal investigation.',
      'The organisation denies wrongdoing. In a statement, it said its research standards are "rigorous and independent" and that the recorded conversations "do not reflect its policies". It has not explained why staff at three different levels of seniority described the same arrangements in the same terms.',
      'The full film and supporting documents are available above. This report is part of our continuing investigation into the influence industry.',
    ],
  },
  {
    slug: 'video-01',
    title: 'Title 01',
    date: '06 July 2026',
    duration: '2:06',
    description: 'A short film from the Verbatim investigations desk.',
    image: '/images/lightwall.jpg',
    alt: 'Two people walking past an illuminated glass wall',
    video: '/videos/video-01.mp4',
    body: [
      'This short film accompanies our ongoing investigation. It documents the people and places behind the story — the offices, the meeting rooms and the streets where the events described in our reporting took place.',
      'Filmed over several weeks, the footage provides context for the written report and includes material that could not be captured in print: the tone of a conversation, the geography of a meeting, the distance between what was said publicly and what was done in private.',
      'The full written investigation is available alongside this film. Verbatim produces independent journalism funded by its readers.',
    ],
  },
  {
    slug: 'video-02',
    title: 'Title 02',
    date: '06 July 2026',
    duration: '2:06',
    description: 'A short film from the Verbatim investigations desk.',
    image: '/images/lightbox.jpg',
    alt: 'Silhouette of a man standing in front of illuminated poster displays',
    video: '/videos/video-02.mp4',
    body: [
      'This short film accompanies our ongoing investigation. It documents the people and places behind the story — the offices, the meeting rooms and the streets where the events described in our reporting took place.',
      'Filmed over several weeks, the footage provides context for the written report and includes material that could not be captured in print: the tone of a conversation, the geography of a meeting, the distance between what was said publicly and what was done in private.',
      'The full written investigation is available alongside this film. Verbatim produces independent journalism funded by its readers.',
    ],
  },
  {
    slug: 'video-03',
    title: 'Title 03',
    date: '06 July 2026',
    duration: '2:06',
    description: 'A short film from the Verbatim investigations desk.',
    image: '/images/chair.jpg',
    alt: 'Close-up of a moulded plastic chair in black and white',
    video: '/videos/video-03.mp4',
    body: [
      'This short film accompanies our ongoing investigation. It documents the people and places behind the story — the offices, the meeting rooms and the streets where the events described in our reporting took place.',
      'Filmed over several weeks, the footage provides context for the written report and includes material that could not be captured in print: the tone of a conversation, the geography of a meeting, the distance between what was said publicly and what was done in private.',
      'The full written investigation is available alongside this film. Verbatim produces independent journalism funded by its readers.',
    ],
  },
  {
    slug: 'article-01',
    title: 'Title 01',
    date: '06 July 2026',
    duration: null,
    description: 'An article from the Verbatim investigations desk.',
    image: null,
    alt: '',
    video: null,
    body: [
      'This article is part of the written record of our investigation. It sets out, in detail, the evidence summarised in the films: the documents, the recordings and the accounts of those who were in the room.',
      'Every claim in our reporting is supported by at least two independent sources. Where we rely on documents, we describe their provenance as fully as we can without endangering the people who provided them. Where we rely on testimony, we corroborate it against the written record.',
      'Those named in this reporting were given the opportunity to respond before publication, and their responses are reflected in the text. Corrections and clarifications, where required, are published at the foot of the article.',
      'Verbatim is an independent, reader-funded newsroom. If you value reporting like this, consider supporting our work.',
    ],
  },
  {
    slug: 'article-02',
    title: 'Title 02',
    date: '06 July 2026',
    duration: null,
    description: 'An article from the Verbatim investigations desk.',
    image: null,
    alt: '',
    video: null,
    body: [
      'This article is part of the written record of our investigation. It sets out, in detail, the evidence summarised in the films: the documents, the recordings and the accounts of those who were in the room.',
      'Every claim in our reporting is supported by at least two independent sources. Where we rely on documents, we describe their provenance as fully as we can without endangering the people who provided them. Where we rely on testimony, we corroborate it against the written record.',
      'Those named in this reporting were given the opportunity to respond before publication, and their responses are reflected in the text. Corrections and clarifications, where required, are published at the foot of the article.',
      'Verbatim is an independent, reader-funded newsroom. If you value reporting like this, consider supporting our work.',
    ],
  },
  {
    slug: 'article-03',
    title: 'Title 03',
    date: '06 July 2026',
    duration: null,
    description: 'An article from the Verbatim investigations desk.',
    image: null,
    alt: '',
    video: null,
    body: [
      'This article is part of the written record of our investigation. It sets out, in detail, the evidence summarised in the films: the documents, the recordings and the accounts of those who were in the room.',
      'Every claim in our reporting is supported by at least two independent sources. Where we rely on documents, we describe their provenance as fully as we can without endangering the people who provided them. Where we rely on testimony, we corroborate it against the written record.',
      'Those named in this reporting were given the opportunity to respond before publication, and their responses are reflected in the text. Corrections and clarifications, where required, are published at the foot of the article.',
      'Verbatim is an independent, reader-funded newsroom. If you value reporting like this, consider supporting our work.',
    ],
  },
  {
    slug: 'article-04',
    title: 'Title 04',
    date: '06 July 2026',
    duration: null,
    description: 'An article from the Verbatim investigations desk.',
    image: null,
    alt: '',
    video: null,
    body: [
      'This article is part of the written record of our investigation. It sets out, in detail, the evidence summarised in the films: the documents, the recordings and the accounts of those who were in the room.',
      'Every claim in our reporting is supported by at least two independent sources. Where we rely on documents, we describe their provenance as fully as we can without endangering the people who provided them. Where we rely on testimony, we corroborate it against the written record.',
      'Those named in this reporting were given the opportunity to respond before publication, and their responses are reflected in the text. Corrections and clarifications, where required, are published at the foot of the article.',
      'Verbatim is an independent, reader-funded newsroom. If you value reporting like this, consider supporting our work.',
    ],
  },
];

export function getStory(slug: string): Story {
  const story = stories.find((s) => s.slug === slug);
  if (!story) throw new Error(`Unknown story: ${slug}`);
  return story;
}
