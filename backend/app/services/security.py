import sys
import json
import logging
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional

from app.config import settings
from app.schemas import BanditFinding, SecurityScanResponse

logger = logging.getLogger(__name__)

# Common Bandit vulnerability explanations and recommended fixes
REMEDIATION_GUIDE: Dict[str, Dict[str, str]] = {
    "B101": {
        "title": "Assert Used Outside of Test Suite",
        "cwe": "CWE-617: Reachable Assertion",
        "risk": "Assert statements are removed when Python compiles with optimizations (-O flag). Never use assert for production validation or security checks.",
        "fix": "Replace `assert condition` with explicit conditional logic: `if not condition: raise ValueError(...)`."
    },
    "B105": {
        "title": "Hardcoded Password String",
        "cwe": "CWE-259: Use of Hard-coded Password",
        "risk": "Secrets committed to code repositories can be extracted by attackers or leaked in version control history.",
        "fix": "Store credentials in environment variables or secret managers (e.g. `os.environ.get('DB_PASSWORD')`)."
    },
    "B106": {
        "title": "Hardcoded Password in Function Argument",
        "cwe": "CWE-259: Use of Hard-coded Password",
        "risk": "Default parameter values containing passwords expose credentials directly in source files.",
        "fix": "Pass secrets as runtime environment configuration or inject via secure settings."
    },
    "B301": {
        "title": "Unsafe Deserialization via Pickle",
        "cwe": "CWE-502: Deserialization of Untrusted Data",
        "risk": "Pickle deserialization allows arbitrary Python bytecode execution (Remote Code Execution / RCE).",
        "fix": "Use safe serialization formats such as JSON (`json.loads`), Protocol Buffers, or HMAC-signed payloads."
    },
    "B303": {
        "title": "Insecure Cryptographic Hash (MD5)",
        "cwe": "CWE-327: Use of a Broken or Risky Cryptographic Algorithm",
        "risk": "MD5 suffers from known collision vulnerabilities and should never be used for security, password hashing, or digital signatures.",
        "fix": "Use SHA-256 (`hashlib.sha256`), SHA-3, or bcrypt/argon2 for password hashing."
    },
    "B602": {
        "title": "Subprocess Call with shell=True",
        "cwe": "CWE-78: OS Command Injection",
        "risk": "Passing `shell=True` to subprocess functions allows attackers to chain shell commands via command separators (;, &&, |).",
        "fix": "Pass command arguments as a list of strings with `shell=False`: `subprocess.run(['cmd', arg1, arg2])`."
    },
    "B608": {
        "title": "SQL Injection Vector via String Formatting",
        "cwe": "CWE-89: SQL Injection",
        "risk": "Constructing SQL queries using string formatting (`%s`, `.format()`, or f-strings) allows attackers to alter query logic.",
        "fix": "Use parameterized queries or SQLAlchemy ORM bound parameters: `cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))`."
    }
}

class SecurityScannerService:
    """
    Static Application Security Testing (SAST) service using Bandit.
    Scans repository Python files for security flaws, parses structured JSON findings,
    and enriches with remediation guidance.
    """

    _instance: Optional["SecurityScannerService"] = None

    @classmethod
    def get_instance(cls) -> "SecurityScannerService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def scan_repository(self, repo_dir: Path, repository_id: str) -> SecurityScanResponse:
        """
        Executes Bandit security scan over repository directory.
        """
        if not repo_dir.exists():
            raise FileNotFoundError(f"Repository directory does not exist: {repo_dir}")

        # Command to invoke bandit recursively with json output and exit-zero
        cmd = [
            sys.executable, "-m", "bandit",
            "-r", str(repo_dir),
            "-f", "json",
            "--exit-zero",
            "-x", "venv,.venv,.git,__pycache__,tests,node_modules,dist,build"
        ]

        logger.info(f"Running Bandit SAST scan on: {repo_dir}")
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60,
                check=False
            )
        except subprocess.TimeoutExpired:
            logger.error("Bandit SAST scan timed out after 60s")
            return SecurityScanResponse(
                repository_id=repository_id,
                total_findings=0,
                findings=[]
            )
        except Exception as e:
            logger.error(f"Failed to execute Bandit: {e}", exc_info=True)
            raise RuntimeError(f"Bandit execution failed: {str(e)}") from e

        # Parse JSON output
        findings: List[BanditFinding] = []
        raw_output = result.stdout.strip()
        if not raw_output:
            logger.warning("Bandit returned empty output")
            return SecurityScanResponse(
                repository_id=repository_id,
                total_findings=0,
                findings=[]
            )

        try:
            data = json.loads(raw_output)
            results = data.get("results", [])

            for item in results:
                raw_filename = item.get("filename", "")
                try:
                    rel_file = str(Path(raw_filename).relative_to(repo_dir)).replace("\\", "/")
                except ValueError:
                    rel_file = Path(raw_filename).name

                test_id = item.get("test_id", "UNKNOWN")
                guide = REMEDIATION_GUIDE.get(test_id, {})

                finding = BanditFinding(
                    file=rel_file,
                    line=item.get("line_number", 1),
                    test_id=test_id,
                    issue_severity=item.get("issue_severity", "LOW").upper(),
                    issue_confidence=item.get("issue_confidence", "LOW").upper(),
                    issue_text=item.get("issue_text", "Security issue detected"),
                    code_snippet=item.get("code"),
                    remediation_title=guide.get("title"),
                    remediation_risk=guide.get("risk"),
                    remediation_fix=guide.get("fix")
                )
                findings.append(finding)

        except json.JSONDecodeError as e:
            logger.error(f"Failed to decode Bandit JSON output: {e}\nRaw output: {raw_output[:500]}")

        # Sort findings: HIGH first, then MEDIUM, then LOW
        severity_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
        findings.sort(key=lambda f: (severity_order.get(f.issue_severity, 3), f.file, f.line))

        return SecurityScanResponse(
            repository_id=repository_id,
            total_findings=len(findings),
            findings=findings
        )

    def get_remediation_info(self, test_id: str) -> Optional[Dict[str, str]]:
        """Retrieve remediation guide details for a specific Bandit test ID."""
        return REMEDIATION_GUIDE.get(test_id)


def get_security_scanner() -> SecurityScannerService:
    return SecurityScannerService.get_instance()
