import { LoginCredentialsForm } from "./LoginCredentialsForm";

function LoginWidget() {
	const btnActiveClasses =
		"bg-gradient-to-r from-[#ef9b20] to-[#ffbf62] text-[#0b273c]";

	return (
		<div className="flex flex-col items-center justify-center gap-4">
			<div className="flex h-12 text-[15px] font-medium">
				<button
					type="button"
					className={`h-full w-48 rounded-full py-2.5 ${btnActiveClasses}`}
				>
					ورود با رمز ثابت
				</button>
			</div>

			<LoginCredentialsForm />
			{/* ورود با رمز یکبار مصرف فعلاً غیرفعال است. */}
		</div>
	);
}

export { LoginWidget };
