/** Shapes of data/music.json (see $lib/server/music). */

export interface MusicVersion {
	label: string;
	src: string;
}

export interface MusicSong {
	slug: string;
	title: string;
	genre?: string;
	lyrics: string;
	versions: MusicVersion[];
}

export interface MusicPage {
	slug: string;
	title: string;
	description: string;
	songs: MusicSong[];
}

export interface PronunciationExample {
	spelling: string;
	song: string;
	date: string;
	src: string;
}

export interface MusicLibrary {
	title: string;
	intro: string;
	githubUrl: string;
	pages: MusicPage[];
	pronunciation: {
		sections: { heading: string; body: string }[];
		examples: PronunciationExample[];
	};
}
