import type { PropsWithChildren } from "react";
import Image from "next/image";

import authBackground from "@/assets/images/auth-bg.svg";
import authLogo from "@/assets/images/brand-logo.svg";

function AuthLayout({ children }: PropsWithChildren) {
	return (
		<div className="flex w-full">
			<div className="fixed end-0 hidden h-screen w-1/2 lg:block">
				<Image
					className="pointer-events-none object-cover"
					src={authBackground}
					sizes="(max-width: 1024px) 100vw, 100vh"
					alt="REVAL"
					fill
					loading="eager"
				/>
			</div>

			<div className="flex h-full min-h-screen w-full flex-col items-center justify-center space-y-10 lg:w-1/2">
				<div className="pointer-events-none flex flex-col items-center gap-4 px-24 py-10 md:px-32 md:py-12">
					<Image
						src={authLogo}
						alt="لوگوی سامانه"
						loading="eager"
						width={140}
						height={140}
						className="h-[140px] w-[140px] object-contain"
					/>
					<h1 className="text-center text-xl font-bold text-[#0A263B]">
						سامانه جامع آتیه پژوهان کیفیت
					</h1>
				</div>

				<div className="flex items-center justify-center pb-12">{children}</div>
			</div>
		</div>
	);
}

export default AuthLayout;
