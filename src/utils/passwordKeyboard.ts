// Standard Korean two-set keyboard → the corresponding QWERTY key sequence.
// Keep Latin letters (including case), numbers, punctuation and other scripts intact.
const initials = ['r','R','s','e','E','f','a','q','Q','t','T','d','w','W','c','z','x','v','g']
const vowels = ['k','o','i','O','j','p','u','P','h','hk','ho','hl','y','n','nj','np','nl','b','m','ml','l']
const finals = ['', 'r','R','rt','s','sw','sg','e','f','fr','fa','fq','ft','fx','fv','fg','a','q','qt','t','T','d','w','c','z','x','v','g']
const consonants = 'ㄱㄲㄳㄴㄵㄶㄷㄸㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅃㅄㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const consonantKeys = ['r','R','rt','s','sw','sg','e','E','f','fr','fa','fq','ft','fx','fv','fg','a','q','Q','qt','t','T','d','w','W','c','z','x','v','g']

export function toEnglishPasswordKeys(value: string): string {
  return Array.from(value).map((character) => {
    const code = character.codePointAt(0)!
    if (code >= 0xac00 && code <= 0xd7a3) {
      const syllable = code - 0xac00
      return initials[Math.floor(syllable / 588)] + vowels[Math.floor((syllable % 588) / 28)] + finals[syllable % 28]
    }
    const consonant = consonants.indexOf(character)
    if (consonant >= 0) return consonantKeys[consonant]
    if (code >= 0x314f && code <= 0x3163) return vowels[code - 0x314f]
    if (code >= 0x1100 && code <= 0x1112) return initials[code - 0x1100]
    if (code >= 0x1161 && code <= 0x1175) return vowels[code - 0x1161]
    if (code >= 0x11a8 && code <= 0x11c2) return finals[code - 0x11a7]
    return character
  }).join('')
}
