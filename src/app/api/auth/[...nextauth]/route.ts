import NextAuth, { NextAuthOptions } from "next-auth"
import GithubProvider from "next-auth/providers/github"

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
		async jwt({token}) {
			token.userRole = "admin"
			return token
		},
	},
	secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }
