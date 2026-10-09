import NextAuth, { NextAuthOptions } from "next-auth"
import GithubProvider from "next-auth/providers/github"
import { isAllowedGithubUser } from "../allowedUser"

const authOptions: NextAuthOptions = {
	session: {
		strategy: "jwt",
	},
	providers: [
		GithubProvider({
			clientId: process.env.GITHUB_ID as string,
			clientSecret: process.env.GITHUB_SECRET as string,
		}),
	],
	theme: {
		colorScheme: "dark",
	},
	callbacks: {
		async signIn({user}) {
			return isAllowedGithubUser(user.id)
		},
		async jwt({token}) {
			// Signs out sessions that belong to another account: throwing here makes
			// next-auth delete the session cookie.
			if (!isAllowedGithubUser(token.sub)) throw new Error("GitHub account not allowed")
			token.userRole = "admin"
			return token
		},
	},
	secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }
