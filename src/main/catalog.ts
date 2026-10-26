import type { Game } from '@shared/types'

// Giochi iniziali. I colori sono ricavati dai siti originali (sfondo, testo, accento);
// le icone NON sono incluse: vengono scaricate dalla favicon all'avvio.
export const DEFAULT_GAMES: Game[] = [
  {
    id: 'spotle-movies',
    name: 'Spotle Movies',
    url: 'https://spotle.movie/',
    category: 'Film',
    theme: { bg: '#060B14', header: '#0B1623', headerText: '#EAF0FF', accent: '#FFB020' }
  },
  {
    id: 'farflung',
    name: 'Farflung',
    url: 'https://farflung.game/',
    category: 'Geografia',
    theme: { bg: '#F4E9CD', header: '#2B2118', headerText: '#F4E9CD', accent: '#B8322B' }
  },
  {
    id: 'krillion',
    name: 'Krillion',
    url: 'https://krillion.io/',
    category: 'Indovinelli',
    theme: { bg: '#050A14', header: '#0D1830', headerText: '#E8F1FF', accent: '#4DE3FF' }
  },
  {
    id: 'spotle-tv',
    name: 'Spotle TV',
    url: 'https://www.spotle.tv/',
    category: 'Serie TV',
    theme: { bg: '#0B1121', header: '#131C36', headerText: '#F8FAFC', accent: '#58A6FF' }
  }
]
